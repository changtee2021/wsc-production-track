// Excel-like export helpers for pivoted production history.
import * as XLSX from "xlsx";
import type { ExcelJob } from "@/lib/features/production-excel.functions";

const FIXED = ["วันเริ่ม", "วันจบ", "Job", "หมวดหมู่", "เวลาเริ่ม", "เวลาจบ", "จำนวนขั้นตอน"];

export function buildHeaders(maxSteps: number): string[] {
  const out = [...FIXED];
  for (let i = 1; i <= maxSteps; i++) {
    out.push(`ขั้นตอน(${i})`, `พนักงาน(${i})`, `เวลาเริ่ม(${i})`, `เวลาจบ(${i})`);
  }
  return out;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function buildRows(jobs: ExcelJob[], maxSteps: number): string[][] {
  return jobs.map((j) => {
    const row: string[] = [
      fmtDate(j.started_at),
      fmtDate(j.finished_at),
      j.job_id,
      j.category_name ?? "",
      fmtTime(j.started_at),
      fmtTime(j.finished_at),
      String(j.step_count),
    ];
    for (let i = 0; i < maxSteps; i++) {
      const s = j.steps[i];
      if (s) {
        row.push(
          s.step_name,
          s.emp_code ? `${s.employee_name} (${s.emp_code})` : s.employee_name,
          fmtTime(s.started_at),
          fmtTime(s.finished_at),
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
