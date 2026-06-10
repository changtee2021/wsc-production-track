// Excel-like export helpers for pivoted production history.
import * as XLSX from "xlsx";
import type { ExcelJob } from "@/lib/features/production-excel.functions";

const FIXED = ["Job", "หมวดหมู่", "เวลาเริ่ม", "เวลาจบ", "จำนวนขั้นตอน"];

export function buildHeaders(maxSteps: number): string[] {
  const out = [...FIXED];
  for (let i = 1; i <= maxSteps; i++) {
    out.push(`ขั้นตอน(${i})`, `พนักงาน(${i})`, `เวลาเริ่ม(${i})`, `เวลาจบ(${i})`);
  }
  return out;
}

function fmt(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("th-TH", { hour12: false });
}

export function buildRows(jobs: ExcelJob[], maxSteps: number): string[][] {
  return jobs.map((j) => {
    const row: string[] = [
      j.job_id,
      j.category_name ?? "",
      fmt(j.started_at),
      fmt(j.finished_at),
      String(j.step_count),
    ];
    for (let i = 0; i < maxSteps; i++) {
      const s = j.steps[i];
      if (s) {
        row.push(
          s.step_name,
          s.emp_code ? `${s.employee_name} (${s.emp_code})` : s.employee_name,
          fmt(s.started_at),
          fmt(s.finished_at),
        );
      } else {
        row.push("", "", "", "");
      }
    }
    return row;
  });
}

function escapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function timestampName(prefix: string, ext: string): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.${ext}`;
}

export function downloadCsv(headers: string[], rows: string[][]) {
  const lines = [headers.map(escapeCell).join(",")];
  for (const r of rows) lines.push(r.map(escapeCell).join(","));
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = timestampName("production-excel", "csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadXlsx(headers: string[], rows: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ProductionHistory");
  XLSX.writeFile(wb, timestampName("production-excel", "xlsx"));
}
