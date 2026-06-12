/** Format auto-number from template string */
export function formatAutoNo(
  template: string,
  vars: { receipt_no?: string; date?: Date; seq?: number },
): string {
  const d = vars.date ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const seq = vars.seq ?? 1;
  return template
    .replace("{receipt_no}", vars.receipt_no ?? "")
    .replace("{date:YYYYMMDD}", `${y}${m}${day}`)
    .replace("{seq:03d}", String(seq).padStart(3, "0"))
    .replace("{seq:04d}", String(seq).padStart(4, "0"));
}
