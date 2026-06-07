// CSV + XLSX exporters for production dashboard (historical view).
import * as XLSX from "xlsx";

type Timeline = {
  employee_name: string;
  emp_code: string | null;
  job_id: string;
  step_name: string;
  category_name: string | null;
  started_at: string;
  finished_at: string;
  actual_seconds: number;
  target_seconds: number | null;
  exceeded: boolean;
};
type ByEmployee = {
  employee_name: string;
  emp_code: string | null;
  finished_count: number;
  total_seconds: number;
  exceeded_count: number;
  is_red: boolean;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH");
}
function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildHistoryCsv(timeline: Timeline[]): string {
  const header = [
    "วันที่",
    "พนักงาน",
    "รหัส",
    "Job",
    "ขั้นตอน",
    "หมวด",
    "เริ่ม",
    "เสร็จ",
    "เวลาจริง(วิ)",
    "มาตรฐาน(วิ)",
    "เกินมาตรฐาน",
  ];
  const lines = [header.join(",")];
  for (const t of timeline) {
    lines.push(
      [
        new Date(t.finished_at).toLocaleDateString("th-TH"),
        t.employee_name,
        t.emp_code ?? "",
        t.job_id,
        t.step_name,
        t.category_name ?? "",
        fmtDate(t.started_at),
        fmtDate(t.finished_at),
        t.actual_seconds,
        t.target_seconds ?? "",
        t.exceeded ? "เกิน" : "",
      ]
        .map(escapeCell)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadHistoryCsv(
  timeline: Timeline[],
  filenameBase: string,
) {
  const csv = buildHistoryCsv(timeline);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadHistoryXlsx(
  byEmployee: ByEmployee[],
  timeline: Timeline[],
  filenameBase: string,
) {
  const wb = XLSX.utils.book_new();
  const summary = byEmployee.map((e) => ({
    พนักงาน: e.employee_name,
    รหัส: e.emp_code ?? "",
    "งานเสร็จ(ครั้ง)": e.finished_count,
    "เวลารวม(วิ)": e.total_seconds,
    "เกินมาตรฐาน(ครั้ง)": e.exceeded_count,
    ไฟแดง: e.is_red ? "🔴" : "",
  }));
  const tl = timeline.map((t) => ({
    วันที่: new Date(t.finished_at).toLocaleDateString("th-TH"),
    พนักงาน: t.employee_name,
    รหัส: t.emp_code ?? "",
    Job: t.job_id,
    ขั้นตอน: t.step_name,
    หมวด: t.category_name ?? "",
    เริ่ม: fmtDate(t.started_at),
    เสร็จ: fmtDate(t.finished_at),
    "เวลาจริง(วิ)": t.actual_seconds,
    "มาตรฐาน(วิ)": t.target_seconds ?? "",
    เกินมาตรฐาน: t.exceeded ? "เกิน" : "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "สรุปต่อคน");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tl), "Timeline");
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
}

// ---- Employee profile export (multi-sheet) ----

export function downloadProfileXlsx(
  filenameBase: string,
  sheets: Record<string, Array<Record<string, unknown>>>,
) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    if (!rows || rows.length === 0) continue;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
}
