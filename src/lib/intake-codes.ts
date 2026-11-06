/** Pull a job id out of a scanned QR. A plain code stays as-is. */
export function readJobCode(text: string): string {
  const raw = text.trim();
  try {
    const fromQuery = new URL(raw).searchParams.get("job_id");
    if (fromQuery) return fromQuery.trim();
  } catch {
    // The QR is a plain job id, not a link.
  }
  return raw;
}

/**
 * Codes already in `blocked` (this batch, an earlier set, or the line) stay off the list.
 * The same code twice in one photo counts once.
 */
export function freshJobCodes(
  raws: string[],
  blocked: ReadonlySet<string>,
): { fresh: string[]; skipped: number } {
  const fresh: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const raw of raws) {
    const code = readJobCode(raw);
    if (!code) continue;
    if (blocked.has(code) || seen.has(code)) {
      skipped += 1;
      continue;
    }
    seen.add(code);
    fresh.push(code);
  }
  return { fresh, skipped };
}

export async function collectFreshJobCodes(
  raws: string[],
  blocked: ReadonlySet<string>,
  isReleased: (code: string) => Promise<boolean>,
): Promise<{ fresh: string[]; skipped: number; failed: number }> {
  const seen = new Set<string>();
  const candidates: string[] = [];
  let skipped = 0;
  for (const raw of raws) {
    const code = readJobCode(raw);
    if (!code) continue;
    if (blocked.has(code) || seen.has(code)) {
      skipped += 1;
      continue;
    }
    seen.add(code);
    candidates.push(code);
  }

  const open = new Set<string>();
  let failed = 0;
  await Promise.all(
    candidates.map(async (code) => {
      try {
        if (await isReleased(code)) skipped += 1;
        else open.add(code);
      } catch {
        failed += 1;
      }
    }),
  );
  return { fresh: candidates.filter((code) => open.has(code)), skipped, failed };
}

export function intakeReviewNote(input: {
  found: number;
  fresh: number;
  skipped: number;
  failed: number;
}): string | null {
  if (input.found === 0) return "ไม่พบ QR ในรูปนี้";
  if (input.fresh === 0 && input.failed > 0 && input.skipped === 0) {
    return "ตรวจรหัสไม่สำเร็จ จึงไม่ขึ้นรายการ";
  }
  if (input.skipped > 0) return `ข้าม ${input.skipped} ใบที่สแกนแล้ว`;
  return null;
}
