/** Thailand (Asia/Bangkok, UTC+7) date helpers for production dashboards. */

const BANGKOK = "Asia/Bangkok";

/** Calendar date key YYYY-MM-DD in Bangkok. */
export function bangkokDateKey(input?: Date | string | number): string {
  const d = input === undefined ? new Date() : new Date(input);
  if (Number.isNaN(d.getTime())) return bangkokDateKey();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
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
export function latestFinishDayBangkok(
  logs: { action: string; created_at: string }[],
): string {
  let best: string | null = null;
  for (const l of logs) {
    if (l.action !== "finish") continue;
    const key = bangkokDateKey(l.created_at);
    if (!best || key > best) best = key;
  }
  return best ?? todayBangkok();
}
