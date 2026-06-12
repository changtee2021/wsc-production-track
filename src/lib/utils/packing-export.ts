interface MediaItem {
  url: string;
  type: "image" | "video";
}
interface PackingReportItem {
  item_order: number;
  item_text_snapshot: string;
  is_passed: boolean;
  remark: string | null;
  media: MediaItem[];
}
interface PackingReportRow {
  id: string;
  job_id: string;
  created_at: string;
  note: string | null;
  overall_result: "pass" | "fail" | null;
  summary: string | null;
  packing_employees: { name: string; emp_code: string | null } | null;
  employees: { name: string; emp_code: string | null } | null;
  steps: { step_name: string } | null;
  categories: { name: string } | null;
  packing_report_items: PackingReportItem[] | null;
}

const escapeCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const HEADERS = [
  "report_id",
  "created_at",
  "job_id",
  "category",
  "step",
  "packing_employee",
  "worker",
  "overall_result",
  "overall_summary",
  "overall_note",
  "item_order",
  "item_text",
  "item_result",
  "item_remark",
  "item_media_count",
  "item_media_urls",
];

export function buildPackingReportsCsv(reports: PackingReportRow[]): string {
  const lines: string[] = [HEADERS.join(",")];
  for (const r of reports) {
    const base = [
      r.id,
      new Date(r.created_at).toLocaleString("th-TH"),
      r.job_id,
      r.categories?.name ?? "",
      r.steps?.step_name ?? "",
      r.packing_employees?.name ?? "",
      r.employees?.name ?? "",
      r.overall_result === "pass" ? "ผ่าน" : r.overall_result === "fail" ? "ไม่ผ่าน" : "",
      r.summary ?? "",
      r.note ?? "",
    ];
    const items = [...(r.packing_report_items ?? [])].sort((a, b) => a.item_order - b.item_order);
    if (items.length === 0) {
      lines.push([...base, "", "", "", "", "0", ""].map(escapeCell).join(","));
      continue;
    }
    for (const it of items) {
      lines.push(
        [
          ...base,
          it.item_order,
          it.item_text_snapshot,
          it.is_passed ? "ผ่าน" : "ไม่ผ่าน",
          it.remark ?? "",
          it.media?.length ?? 0,
          (it.media ?? []).map((m) => m.url).join(";"),
        ]
          .map(escapeCell)
          .join(","),
      );
    }
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadPackingReportsCsv(reports: PackingReportRow[]) {
  const csv = buildPackingReportsCsv(reports);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fname = `packing-reports-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
