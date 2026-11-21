// Pure business-hours helpers shared by the server and the browser. Local time comes from Intl, so no time zone library is needed.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type DayHours = { open: string; close: string };
export type WeekHours = Partial<Record<Day, DayHours | null>>;

export const DAY_NAMES: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function validTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 60) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isConfigured(hours: WeekHours | null | undefined): hours is WeekHours {
  return !!hours && DAYS.some((d) => d in hours);
}

type Local = { year: number; month: number; day: number; weekday: Day; minutes: number };

const WEEKDAY_FROM_SHORT: Record<string, Day> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };

function localParts(at: Date, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAY_FROM_SHORT[get("weekday")] ?? "mon",
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

// Converts a wall-clock time in the zone to the matching instant. Two passes settle zones whose offset changes on that day.
function zonedInstant(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const offsetAt = (t: number) => {
    const l = localParts(new Date(t), timeZone);
    return Date.UTC(l.year, l.month - 1, l.day, 0, l.minutes) - t;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

// A shop with no hours saved is treated as always open.
export function isOpenNow(hours: WeekHours | null | undefined, timeZone: string, at: Date): boolean {
  if (!isConfigured(hours)) return true;
  const now = localParts(at, timeZone);
  const today = hours[now.weekday];
  if (!today) return false;
  return now.minutes >= toMinutes(today.open) && now.minutes < toMinutes(today.close);
}

export function nextOpening(hours: WeekHours | null | undefined, timeZone: string, from: Date): { at: Date; label: string } | null {
  if (!isConfigured(hours)) return null;
  const now = localParts(from, timeZone);
  const startIndex = DAYS.indexOf(now.weekday);
  // Offset 7 is the same weekday next week, which matters when today is the only open day and it has already closed.
  for (let offset = 0; offset <= 7; offset++) {
    const day = DAYS[(startIndex + offset) % 7];
    const range = hours[day];
    if (!range) continue;
    if (offset === 0 && toMinutes(range.open) <= now.minutes) continue;
    const date = new Date(Date.UTC(now.year, now.month - 1, now.day + offset));
    const at = zonedInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), toMinutes(range.open), timeZone);
    return { at, label: `${DAY_NAMES[day]} ${range.open}` };
  }
  return null;
}

export function validateHours(input: unknown): { ok: true; hours: WeekHours } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, hours: {} };
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Business hours must be an object with one entry per weekday." };
  const raw = input as Record<string, unknown>;
  const unknown = Object.keys(raw).find((k) => !(DAYS as readonly string[]).includes(k));
  if (unknown) return { ok: false, error: `Business hours contain an unknown day: ${unknown.slice(0, 20)}.` };

  const hours: WeekHours = {};
  for (const day of DAYS) {
    if (!(day in raw)) continue;
    const value = raw[day];
    if (value === null) {
      hours[day] = null;
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: `${DAY_NAMES[day]}: enter an opening and a closing time, or mark the day as closed.` };
    const { open, close } = value as Record<string, unknown>;
    if (typeof open !== "string" || typeof close !== "string" || !TIME.test(open) || !TIME.test(close)) {
      return { ok: false, error: `${DAY_NAMES[day]}: enter times as hours and minutes, for example 09:00.` };
    }
    if (toMinutes(close) <= toMinutes(open)) return { ok: false, error: `${DAY_NAMES[day]}: the closing time must be after the opening time.` };
    hours[day] = { open, close };
  }
  return { ok: true, hours };
}

// Groups consecutive days that share the same times, for example "Monday to Friday 09:00 to 18:00".
export function summarizeHours(hours: WeekHours): string {
  const groups: { from: Day; to: Day; range: DayHours }[] = [];
  for (const day of DAYS) {
    const range = hours[day];
    if (!range) continue;
    const last = groups[groups.length - 1];
    const previous = DAYS[DAYS.indexOf(day) - 1];
    if (last && last.to === previous && last.range.open === range.open && last.range.close === range.close) last.to = day;
    else groups.push({ from: day, to: day, range });
  }
  if (groups.length === 0) return "closed every day";
  return groups
    .map((g) => `${g.from === g.to ? DAY_NAMES[g.from] : `${DAY_NAMES[g.from]} to ${DAY_NAMES[g.to]}`} ${g.range.open} to ${g.range.close}`)
    .join(", ");
}

export type HoursStatus = { configured: boolean; openNow: boolean; nextOpening: { at: Date; label: string } | null };

export function hoursStatus(hours: WeekHours | null | undefined, timeZone: string, at: Date): HoursStatus {
  const configured = isConfigured(hours);
  const openNow = isOpenNow(hours, timeZone, at);
  return { configured, openNow, nextOpening: configured && !openNow ? nextOpening(hours, timeZone, at) : null };
}
