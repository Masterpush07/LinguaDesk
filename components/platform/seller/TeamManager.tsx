"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MailPlus, Pencil, Trash2, UserMinus } from "lucide-react";
import { LanguagePicker } from "@/components/platform/seller/LanguagePicker";
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, Card, CopyButton, Dialog, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { NextAction } from "@/components/platform/ui";
import { api, useStaff } from "@/lib/v2/client";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { formatDateTime, languageName, type InviteDto, type TeamMemberDto } from "@/lib/v2/seller-types";

const originStore = {
  subscribe: () => () => {},
  client: () => window.location.origin,
  server: () => "",
};

const inviteLink = (origin: string, code: string) => `${origin}/join?code=${code}`;

const inviteMessage = (shop: string, origin: string, code: string) =>
  `You are invited to join ${shop} on LinguaDesk. Open ${inviteLink(origin, code)}, choose your name and a passcode, and you will join the team. The invite works once.`;

export default function TeamManager() {
  const staff = useStaff({ owner: true });
  const origin = useSyncExternalStore(originStore.subscribe, originStore.client, originStore.server);
  const team = useApi<TeamMemberDto[]>("/api/desk/team");
  const invites = useApi<InviteDto[]>("/api/desk/invites");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMemberDto | null>(null);
  const [langs, setLangs] = useState<string[]>([]);
  const [skills, setSkills] = useState("");
  const [capacity, setCapacity] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refreshTeam = team.reload;
  useEffect(() => {
    const id = setInterval(refreshTeam, 30_000);
    return () => clearInterval(id);
  }, [refreshTeam]);

  const generate = async () => {
    setGenerating(true);
    setActionError("");
    try {
      const { code } = await api<{ code: string }>("/api/desk/invites", { method: "POST", json: {} });
      invites.update((list) => [{ code, createdAt: new Date().toISOString(), createdByName: staff?.name ?? null }, ...list]);
      setNotice(`Invite created. Copy the invite link and send it to your teammate. It works once.`);
    } catch (err) {
      setNotice("");
      setActionError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (code: string) => {
    setRevokingCode(code);
    setActionError("");
    try {
      await api(`/api/desk/invites/${code}`, { method: "DELETE" });
      invites.update((list) => list.filter((i) => i.code !== code));
      setNotice(`Invite code ${code} was revoked.`);
    } catch (err) {
      setNotice("");
      setActionError(errorMessage(err));
    } finally {
      setRevokingCode(null);
    }
  };

  const openEdit = (m: TeamMemberDto) => {
    setEditing(m);
    setLangs(m.languages);
    setSkills(m.skills.join(", "));
    setCapacity(String(m.maxConcurrent));
    setEditError("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const cap = Number(capacity);
    const skillList = Array.from(new Set(skills.split(",").map((s) => s.trim()).filter(Boolean)));
    if (langs.length === 0) return setEditError("Choose at least one language.");
    if (!/^\d+$/.test(capacity.trim()) || cap < 1 || cap > 20) return setEditError("Capacity must be a whole number from 1 to 20.");
    if (skillList.length > 10 || skillList.some((s) => s.length > 40)) return setEditError("Skills: at most 10 items of 40 characters each.");
    setSaving(true);
    setEditError("");
    try {
      const saved = await api<{ id: string; languages: string[]; skills: string[]; maxConcurrent: number }>(`/api/desk/team/${editing.id}`, {
        method: "PATCH",
        json: { languages: langs, skills: skillList, maxConcurrent: cap },
      });
      team.update((list) => list.map((m) => (m.id === saved.id ? { ...m, languages: saved.languages, skills: saved.skills, maxConcurrent: saved.maxConcurrent } : m)));
      setNotice(`${editing.name} was updated.`);
      setEditing(null);
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: TeamMemberDto) => {
    setRemovingId(m.id);
    setActionError("");
    try {
      const res = await api<{ releasedThreads: number }>(`/api/desk/team/${m.id}`, { method: "DELETE" });
      team.update((list) => list.filter((x) => x.id !== m.id));
      setConfirmId(null);
      setNotice(
        res.releasedThreads > 0
          ? `${m.name} was removed. ${res.releasedThreads} open ${res.releasedThreads === 1 ? "conversation was" : "conversations were"} returned to the queue.`
          : `${m.name} was removed from your team.`,
      );
    } catch (err) {
      setNotice("");
      setActionError(`${m.name}: ${errorMessage(err)}`);
    } finally {
      setRemovingId(null);
    }
  };

  const shop = staff?.sellerName ?? "your shop";

  return (
    <div className="space-y-6">
      <Notice message={notice} testId="team-confirmation" />
      {actionError && (
        <p role="alert" data-testid="team-action-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {actionError}
        </p>
      )}

      <Card testId="invite-card">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Add a teammate (optional)</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          You do not need a team. Your AI assistant answers customers and notifies you when it cannot. If someone else will reply to customers, create an invite and send it to them yourself, for example by message or email. They open the link, choose a name and a passcode, and join your shop. Teammates reply to customers; only you can change shop settings.
        </p>
        <button type="button" onClick={generate} disabled={generating} data-testid="invite-generate" className={`${BTN_PRIMARY} mt-4`}>
          <MailPlus className="h-4 w-4" aria-hidden="true" />
          {generating ? "Creating" : "Create an invite"}
        </button>

        {invites.loading && <div className="mt-4"><LoadingBlock label="Loading invites" testId="invites-loading" rows={1} /></div>}
        {invites.error && !invites.data && <div className="mt-4"><ErrorBlock message={invites.error} onRetry={invites.reload} testId="invites-error" /></div>}
        {invites.data && invites.data.length === 0 && (
          <p data-testid="invites-empty" className="mt-4 text-sm text-slate-500">No pending invites.</p>
        )}
        {invites.data && invites.data.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100" data-testid="invite-list">
            {invites.data.map((i) => (
              <li key={i.code} data-testid={`invite-${i.code}`} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <code className="rounded-md bg-slate-100 px-2 py-1 font-mono text-base font-semibold tracking-widest text-slate-900" data-testid={`invite-code-${i.code}`}>{i.code}</code>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Pending</span>
                <span className="text-xs text-slate-500">Created {formatDateTime(i.createdAt)}</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <CopyButton text={inviteMessage(shop, origin, i.code)} label="Copy invite link" testId={`invite-copy-message-${i.code}`} className={`${BTN_GHOST} !px-3 !py-1.5`} />
                  <CopyButton text={i.code} label="Copy code" testId={`invite-copy-code-${i.code}`} className={`${BTN_GHOST} !px-3 !py-1.5`} />
                  <button type="button" onClick={() => revoke(i.code)} disabled={revokingCode === i.code} aria-label={`Revoke invite code ${i.code}`} data-testid={`invite-revoke-${i.code}`} className={`rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 ${FOCUS}`}>
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {invites.data && invites.data.length > 0 && (
          <p className="mt-2 text-xs text-slate-500" data-testid="invite-message-preview">Invite message: {inviteMessage(shop, origin, invites.data[0].code)}</p>
        )}
      </Card>

      <Card className="overflow-x-auto !p-0" testId="team-card">
        <div className="px-5 pt-5">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Team members</h2>
          <p className="mt-0.5 text-sm text-slate-500">Online means their inbox is open. Conversations the AI cannot answer are assigned to online teammates who speak the customer&apos;s language and have capacity. If nobody is online, you are notified in the app.</p>
        </div>
        {team.loading && <div className="p-5"><LoadingBlock label="Loading team" testId="team-loading" rows={2} /></div>}
        {team.error && !team.data && <div className="p-5"><ErrorBlock message={team.error} onRetry={team.reload} testId="team-error" /></div>}
        {team.data && (
          <table className="mt-3 w-full min-w-[760px] text-left text-sm" data-testid="team-table">
            <caption className="sr-only">Members of your team</caption>
            <thead className="border-y border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Member</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Languages</th>
                <th scope="col" className="px-4 py-3 font-medium">Skills</th>
                <th scope="col" className="px-4 py-3 font-medium">Workload</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.data.map((m) => (
                <tr key={m.id} data-testid={`member-${m.id}`} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500" data-testid={`member-role-${m.id}`}>{m.role === "owner" ? "Owner" : "Agent"}</p>
                  </td>
                  <td className="px-4 py-3" data-testid={`member-status-${m.id}`}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.online ? "text-emerald-700" : "text-slate-500"}`}>
                      <span className={`h-2 w-2 rounded-full ${m.online ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
                      {m.online ? "Online" : "Away"}
                    </span>
                    {!m.online && <p className="text-[11px] text-slate-400">{m.lastSeen ? `Last seen ${formatDateTime(m.lastSeen)}` : "Never signed in to the desk"}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700" data-testid={`member-languages-${m.id}`}>{m.languages.map(languageName).join(", ") || "None"}</td>
                  <td className="px-4 py-3 text-xs text-slate-700" data-testid={`member-skills-${m.id}`}>{m.skills.length > 0 ? m.skills.join(", ") : "None listed"}</td>
                  <td className="px-4 py-3 text-xs text-slate-700" data-testid={`member-load-${m.id}`}>{m.activeThreads} of {m.maxConcurrent} conversations</td>
                  <td className="px-4 py-3 text-right">
                    {confirmId === m.id ? (
                      <div className="inline-flex flex-wrap items-center justify-end gap-2" data-testid={`member-remove-confirm-${m.id}`}>
                        <span className="text-xs text-slate-600">Remove {m.name}? Their open conversations return to the queue.</span>
                        <button type="button" onClick={() => remove(m)} disabled={removingId === m.id} data-testid={`member-remove-yes-${m.id}`} className={`${BTN_DANGER} !px-3 !py-1.5`}>
                          <UserMinus className="h-4 w-4" aria-hidden="true" />
                          Remove
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} data-testid={`member-remove-no-${m.id}`} className={`${BTN_GHOST} !px-3 !py-1.5`}>Keep member</button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(m)} aria-label={`Edit ${m.name}`} data-testid={`member-edit-${m.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 ${FOCUS}`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </button>
                        {m.role !== "owner" && (
                          <button type="button" onClick={() => setConfirmId(m.id)} aria-label={`Remove ${m.name}`} data-testid={`member-remove-${m.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 ${FOCUS}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <NextAction title="Next: set your reply target" text="Choose how quickly your team aims to respond. It defines when a conversation counts as overdue." href="/seller/settings" cta="Open settings" />

      {editing && (
        <Dialog title={`Edit ${editing.name}`} description="Languages and capacity decide which conversations this member receives." onClose={() => setEditing(null)} testId="member-dialog">
          <form onSubmit={saveEdit} noValidate className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Languages</p>
              <p className="mb-1.5 text-xs text-slate-500">Choose every language this member can write in.</p>
              <LanguagePicker value={langs} onChange={setLangs} idPrefix="member" label="Languages this member speaks" />
            </div>
            <div>
              <Label htmlFor="mem-skills" hint="Separate with commas, for example Refunds, Custom orders.">Skills</Label>
              <input id="mem-skills" value={skills} onChange={(e) => setSkills(e.target.value)} data-testid="member-skills-input" className={INPUT} />
            </div>
            <div>
              <Label htmlFor="mem-capacity" hint="Most conversations this member handles at once, from 1 to 20.">Capacity</Label>
              <input id="mem-capacity" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-describedby="mem-error" data-testid="member-capacity-input" className={`${INPUT} max-w-28`} />
            </div>
            <FieldError id="mem-error" message={editError} testId="member-edit-error" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} data-testid="member-cancel" className={BTN_GHOST}>Cancel</button>
              <button type="submit" disabled={saving} data-testid="member-save" className={BTN_PRIMARY}>{saving ? "Saving" : "Save changes"}</button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
