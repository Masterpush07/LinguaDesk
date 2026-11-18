"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import {
  buildKnowledge,
  MAX_KNOWLEDGE_CHARS,
  POLICY_FIELDS,
  type Faq,
  type Product,
  type ShopData,
} from "@/lib/shop-data";
import { DEFAULT_SHOP } from "@/lib/shop-defaults";

const INPUT =
  "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>
      )}
    </label>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

const newProduct = (): Product => ({
  id: "",
  name: "",
  description: "",
  price: 10,
  colors: [],
  sizes: [],
  inStock: true,
});

// Owner-only editor for everything the AI is allowed to know. Saving updates the AI, the order builder and the customer's "About" panel.
export default function ShopSettingsPage() {
  const [form, setForm] = useState<ShopData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "failed">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/owner/shop")
      .then(async (res) => {
        if (res.status === 401) return setState("auth");
        if (!res.ok) return setState("failed");
        setForm((await res.json()) as ShopData);
        setState("ready");
      })
      .catch(() => setState("failed"));
  }, []);

  const edit = (patch: (draft: ShopData) => ShopData) => {
    setSaved(false);
    setForm((prev) => (prev ? patch(prev) : prev));
  };
  const setProduct = (i: number, patch: Partial<Product>) =>
    edit((s) => ({
      ...s,
      products: s.products.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const setFaq = (i: number, patch: Partial<Faq>) =>
    edit((s) => ({
      ...s,
      faqs: s.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    }));

  async function save() {
    if (!form || saving) return;
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/owner/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => null)) as
        | (ShopData & { errors?: string[]; error?: string })
        | null;
      if (!res.ok) {
        setErrors(
          body?.errors ?? [body?.error ?? `Could not save (${res.status})`],
        );
        return;
      }
      setForm(body as ShopData);
      setSaved(true);
    } catch {
      setErrors([
        "Could not reach the server. Check your connection and try again.",
      ]);
    } finally {
      setSaving(false);
    }
  }

  const knowledge = form ? buildKnowledge(form) : "";

  return (
    <main className="min-h-dvh bg-surface-2 text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/owner"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"
          >
            &larr; Inbox
          </Link>
          <h1 className="text-lg font-semibold">Shop settings</h1>
          <div className="ml-auto flex items-center gap-2">
            {saved && (
              <span className="text-xs font-medium text-ok-ink">
                Saved. The AI uses it now.
              </span>
            )}
            <ThemeToggle />
            <button
              onClick={() => void save()}
              disabled={!form || saving}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:bg-surface-3 disabled:text-ink-3"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-ink-2">
          Everything here is what the AI assistant is allowed to answer from.
          Anything not written here is treated as unknown and handed to you.
        </p>

        {state === "auth" && (
          <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn-ink">
            Please{" "}
            <Link href="/owner" className="font-semibold underline">
              sign in on the owner page
            </Link>{" "}
            first, then come back.
          </p>
        )}
        {state === "failed" && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink"
          >
            Could not load the shop settings. Refresh the page to try again.
          </p>
        )}
        {state === "loading" && (
          <div
            className="h-40 animate-pulse rounded-2xl bg-surface-3"
            aria-busy="true"
            aria-label="Loading"
          />
        )}
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink"
          >
            <p className="font-semibold">Not saved yet. Please fix:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {form && (
          <>
            <Section title="Shop profile">
              <Field label="Shop name">
                <input
                  className={INPUT}
                  value={form.name}
                  onChange={(e) =>
                    edit((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Short description"
                hint="One or two sentences about what you sell."
              >
                <textarea
                  className={INPUT}
                  rows={2}
                  value={form.tagline}
                  onChange={(e) =>
                    edit((s) => ({ ...s, tagline: e.target.value }))
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Location">
                  <input
                    className={INPUT}
                    value={form.location}
                    onChange={(e) =>
                      edit((s) => ({ ...s, location: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Human support hours">
                  <input
                    className={INPUT}
                    value={form.hours}
                    onChange={(e) =>
                      edit((s) => ({ ...s, hours: e.target.value }))
                    }
                  />
                </Field>
              </div>
              <Field
                label="Contact note"
                hint="For example how orders are confirmed."
              >
                <input
                  className={INPUT}
                  value={form.contact}
                  onChange={(e) =>
                    edit((s) => ({ ...s, contact: e.target.value }))
                  }
                />
              </Field>
            </Section>

            <Section
              title="Products"
              hint="Prices are in US dollars. Out-of-stock products cannot be added to an order."
            >
              {form.products.map((p, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-xl bg-surface-2 p-3 ring-1 ring-line"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                    <Field label="Name">
                      <input
                        className={INPUT}
                        value={p.name}
                        onChange={(e) =>
                          setProduct(i, { name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Price ($)">
                      <input
                        className={INPUT}
                        type="number"
                        min={1}
                        value={p.price || ""}
                        onChange={(e) =>
                          setProduct(i, { price: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea
                      className={INPUT}
                      rows={2}
                      value={p.description}
                      onChange={(e) =>
                        setProduct(i, { description: e.target.value })
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Colours" hint="Separate with commas.">
                      <input
                        className={INPUT}
                        value={p.colors.join(",")}
                        onChange={(e) =>
                          setProduct(i, { colors: e.target.value.split(",") })
                        }
                      />
                    </Field>
                    <Field label="Sizes" hint="Separate with commas.">
                      <input
                        className={INPUT}
                        value={p.sizes.join(",")}
                        onChange={(e) =>
                          setProduct(i, { sizes: e.target.value.split(",") })
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={p.inStock}
                        onChange={(e) =>
                          setProduct(i, { inStock: e.target.checked })
                        }
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      In stock
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        edit((s) => ({
                          ...s,
                          products: s.products.filter((_, j) => j !== i),
                        }))
                      }
                      className="rounded-full px-3 py-1 text-xs font-medium text-danger-ink hover:bg-danger-soft"
                    >
                      Remove product
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  edit((s) => ({
                    ...s,
                    products: [...s.products, newProduct()],
                  }))
                }
                disabled={form.products.length >= 12}
                className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand-ink ring-1 ring-line hover:opacity-90 disabled:opacity-50"
              >
                + Add product
              </button>
            </Section>

            <Section title="Shipping">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Shipping fee ($)"
                  hint="Use 0 for free shipping on every order."
                >
                  <input
                    className={INPUT}
                    type="number"
                    min={0}
                    value={form.shipping.fee}
                    onChange={(e) =>
                      edit((s) => ({
                        ...s,
                        shipping: {
                          ...s.shipping,
                          fee: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Free shipping above ($)"
                  hint="Use 0 for no free-shipping offer."
                >
                  <input
                    className={INPUT}
                    type="number"
                    min={0}
                    value={form.shipping.freeAbove}
                    onChange={(e) =>
                      edit((s) => ({
                        ...s,
                        shipping: {
                          ...s.shipping,
                          freeAbove: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label="Worldwide delivery time">
                  <input
                    className={INPUT}
                    value={form.shipping.worldwideDays}
                    onChange={(e) =>
                      edit((s) => ({
                        ...s,
                        shipping: {
                          ...s.shipping,
                          worldwideDays: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label="Home-country delivery time">
                  <input
                    className={INPUT}
                    value={form.shipping.domesticDays}
                    onChange={(e) =>
                      edit((s) => ({
                        ...s,
                        shipping: {
                          ...s.shipping,
                          domesticDays: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </div>
              <Field
                label="Shipping notes"
                hint="Packing time, tracking, duties and taxes."
              >
                <textarea
                  className={INPUT}
                  rows={2}
                  value={form.shipping.notes}
                  onChange={(e) =>
                    edit((s) => ({
                      ...s,
                      shipping: { ...s.shipping, notes: e.target.value },
                    }))
                  }
                />
              </Field>
            </Section>

            <Section title="Policies">
              {POLICY_FIELDS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <textarea
                    className={INPUT}
                    rows={2}
                    value={form.policies[key]}
                    onChange={(e) =>
                      edit((s) => ({
                        ...s,
                        policies: { ...s.policies, [key]: e.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
            </Section>

            <Section
              title="Frequently asked questions"
              hint="Real questions your customers ask, with the answer you want given."
            >
              {form.faqs.map((f, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-xl bg-surface-2 p-3 ring-1 ring-line"
                >
                  <Field label="Question">
                    <input
                      className={INPUT}
                      value={f.q}
                      onChange={(e) => setFaq(i, { q: e.target.value })}
                    />
                  </Field>
                  <Field label="Answer">
                    <textarea
                      className={INPUT}
                      rows={2}
                      value={f.a}
                      onChange={(e) => setFaq(i, { a: e.target.value })}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() =>
                      edit((s) => ({
                        ...s,
                        faqs: s.faqs.filter((_, j) => j !== i),
                      }))
                    }
                    className="rounded-full px-3 py-1 text-xs font-medium text-danger-ink hover:bg-danger-soft"
                  >
                    Remove FAQ
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  edit((s) => ({ ...s, faqs: [...s.faqs, { q: "", a: "" }] }))
                }
                disabled={form.faqs.length >= 15}
                className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand-ink ring-1 ring-line hover:opacity-90 disabled:opacity-50"
              >
                + Add FAQ
              </button>
            </Section>

            <details className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <summary className="cursor-pointer text-sm font-semibold">
                What the AI knows (preview)
              </summary>
              <p className="mt-2 text-xs text-ink-3">
                This exact text is given to the AI with every customer message.{" "}
                {knowledge.length} of {MAX_KNOWLEDGE_CHARS} characters used.
              </p>
              <pre
                dir="auto"
                className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2"
              >
                {knowledge}
              </pre>
            </details>

            <div className="flex justify-end pb-6">
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Replace everything on this page with the original demo shop? Nothing is saved until you press Save changes.",
                    )
                  ) {
                    setForm(DEFAULT_SHOP);
                    setSaved(false);
                  }
                }}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-line hover:bg-surface-3"
              >
                Reset to demo shop
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
