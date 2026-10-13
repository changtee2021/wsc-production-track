/** Thailand (Asia/Bangkok, UTC+7) date helpers for production dashboards. */

// Thailand has no DST, so a fixed offset is exact. Called millions of times per
// dashboard render — constructing Intl.DateTimeFormat per call froze the page.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const STRING_KEY_CACHE_MAX = 200_000;
const stringKeyCache = new Map<string, string>();

function computeDateKey(input?: Date | string | number): string {
  const d = input === undefined ? new Date() : new Date(input);
  if (Number.isNaN(d.getTime())) return computeDateKey();
  return new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar date key YYYY-MM-DD in Bangkok. */
export function bangkokDateKey(input?: Date | string | number): string {
  if (typeof input !== "string") return computeDateKey(input);
  const cached = stringKeyCache.get(input);
  if (cached !== undefined) return cached;
  const key = computeDateKey(input);
  if (stringKeyCache.size >= STRING_KEY_CACHE_MAX) stringKeyCache.clear();
  stringKeyCache.set(input, key);
  return key;
}

/** Calendar month key YYYY-MM in Bangkok. */
export function bangkokMonthKey(input?: Date | string | number): string {
  return bangkokDateKey(input).slice(0, 7);
}

/** Today's YYYY-MM-DD in Bangkok. */
export function todayBangkok(): string {
  return bangkokDateKey();
}

/** Current YYYY-MM in Bangkok. */
export function monthBangkok(): string {
  return bangkokMonthKey();
}

/** Add/subtract calendar days from a YYYY-MM-DD key (Bangkok calendar). */
export function shiftBangkokDateKey(key: string, deltaDays: number): string {
  const base = new Date(`${key}T12:00:00+07:00`);
  if (Number.isNaN(base.getTime())) return todayBangkok();
  base.setTime(base.getTime() + deltaDays * 86_400_000);
  return bangkokDateKey(base);
}

/**
 * Latest Bangkok calendar day that has at least one `finish` log.
 * Falls back to `todayBangkok()` when none found.
 */
export function latestFinishDayBangkok(logs: { action: string; created_at: string }[]): string {
  let best: string | null = null;
  for (const l of logs) {
    if (l.action !== "finish") continue;
    const key = bangkokDateKey(l.created_at);
    if (!best || key > best) best = key;
  }
  return best ?? todayBangkok();
}
