// Thai-only translation helper. Multi-language support was removed; the
// `useI18n` shape is preserved so existing callers don't need to change.

type Vars = Record<string, string | number>;

const dict: Record<string, string> = {
  "page.title": "สแกนงาน — ProductionTrack",
  "page.desc":
    "สแกน QR code เพื่อบันทึกเวลาเริ่มและเสร็จงานในสายการผลิต ใช้งานง่ายบนมือถือ",
  "header.admin": "ผู้ดูแล",
  "job.label": "รหัสงาน (Job ID)",
  "job.autoHint": "ระบบดึงรหัสจาก QR code อัตโนมัติ ไม่ต้องพิมพ์เอง",
  "job.empty": 'ยังไม่มีรหัสงาน — กดปุ่ม "สแกน QR" หรือกรอกด้วยตัวเอง',
  "job.scan": "สแกน QR",
  "job.placeholder": "หรือพิมพ์รหัสงาน เช่น JOB123",
  "job.resetTitle": "ล้างรหัสงานเพื่อสแกนใหม่",
  "job.confirmTitle": "ยืนยันรหัสงาน",
  "cat.title": "หมวดหมู่งานม่าน",
  "cat.placeholder": "-- เลือกหมวดหมู่ --",
  "emp.title": "เลือกพนักงาน",
  "emp.loading": "กำลังโหลด…",
  "emp.placeholder": "-- เลือกพนักงาน --",
  "step.title": "เลือกขั้นตอนการผลิต",
  "step.placeholder": "-- เลือกขั้นตอน --",
  "step.minutes": "นาที",
  "step.warning": "ขั้นตอนนี้ไม่ควรเกิน {n} นาที",
  "action.start": "เริ่มงาน",
  "action.finish": "เสร็จงาน",
  "action.saving": "กำลังบันทึก…",
  "note.toggle": "มีปัญหา? เพิ่มหมายเหตุก่อนจบงาน",
  "note.placeholder": "อธิบายปัญหาที่พบ…",
  "note.addPhoto": "เพิ่มรูปภาพ",
  "note.changePhoto": "เปลี่ยนรูป",
  "note.uploading": "กำลังอัปโหลด…",
  "note.required": "กรุณากรอกหมายเหตุก่อนจบงาน",
  "toast.noJob": "ไม่พบรหัสงาน — กรุณาสแกน QR code",
  "toast.noSelect": "กรุณาเลือกพนักงานและขั้นตอน",
  "toast.scanned": "สแกนสำเร็จ: {v}",
  "toast.startedAt": "เริ่มงาน เมื่อ {t}",
  "toast.finishedAt": "เสร็จงาน เมื่อ {t}",
  "log.startOk": "บันทึกการเริ่มงานเรียบร้อย",
  "log.finishOk": "บันทึกการเสร็จงานเรียบร้อย",
};

export function t(key: string, vars?: Vars): string {
  let s = dict[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
  return s;
}

export function useI18n() {
  return { t };
}

export function flagFor(nat: string | null | undefined): string {
  switch (nat?.toLowerCase()) {
    case "thai":
      return "🇹🇭";
    case "burmese":
    case "myanmar":
      return "🇲🇲";
    case "lao":
      return "🇱🇦";
    case "khmer":
    case "cambodian":
      return "🇰🇭";
    default:
      return "👤";
  }
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
