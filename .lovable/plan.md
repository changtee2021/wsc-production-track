## เป้าหมาย

1. แก้ไฟล์ CSV ที่ export ออกมาแล้วภาษาไทยเป็นตัวขยะ (เปิดด้วย Excel แล้วอ่านไม่ออก)
2. ลบปุ่มเปลี่ยนภาษา (ไทย/พม่า) ออกจากหน้าแอพ ใช้ภาษาไทยอย่างเดียว
3. ลดความซ้ำซ้อนของโค้ด + ตรวจ security

---

## 1. แก้ปัญหา CSV ภาษาไทยอ่านไม่ออก

**สาเหตุ**: ไฟล์ CSV ที่สร้างจาก `XLSX.utils.sheet_to_csv` เป็น UTF-8 แต่ไม่มี BOM (Byte Order Mark) ทำให้ Excel เปิดเป็น ANSI/Windows-874 เลยแสดง `à¸£à¸«à¸±à¸ª` แทนภาษาไทย

**วิธีแก้** ใน `src/routes/_protected.dashboard.tsx`:
- เพิ่ม BOM (`\uFEFF`) นำหน้าเนื้อหา CSV ทุกครั้งใน `download()` เมื่อ MIME เป็น `text/csv`
- เปลี่ยน MIME เป็น `text/csv;charset=utf-8`
- หัวคอลัมน์ของ `exportFullCSV` เปลี่ยนเป็นภาษาไทย ให้ตรงกับ `exportSummaryCSV`:
  - `รหัสงาน, พนักงาน, หมวดหมู่, ขั้นตอน, การกระทำ, เวลา`
  - แปลง action `start/finish` → `เริ่มงาน/เสร็จงาน`
  - timestamp ใช้ `toLocaleString("th-TH")` แทน ISO

ผลลัพธ์: เปิดด้วย Excel/Numbers/Google Sheets แล้วเห็นภาษาไทยถูกต้อง

## 2. ลบระบบเปลี่ยนภาษา (เหลือไทยอย่างเดียว)

- ลบ `<LanguageSwitcher />` และ import ออกจาก `src/routes/index.tsx`
- ลบไฟล์ `src/components/LanguageSwitcher.tsx`
- ลด `src/lib/i18n.tsx` ให้เหลือเฉพาะภาษาไทย:
  - ลบ dictionary `my` ทั้งหมด (ลดขนาดไฟล์ ~50%)
  - ลบ `STORAGE_KEY`, `setLang`, การอ่าน localStorage
  - คง `t(key, vars)` ไว้เป็น helper อ่านง่าย ไม่ต้องใช้ Context อีกต่อไป — เปลี่ยนเป็น `export function t(...)` ตรงๆ
  - ลบ `I18nProvider` wrapper ใน `src/routes/__root.tsx`
  - คง `flagFor()` และ `initialsOf()` ไว้
- ลบ key ที่เกี่ยวกับภาษา (`lang.label`, `footer.langs` ฯลฯ ที่ไม่ใช้แล้ว)

## 3. ลดความซ้ำซ้อน + Security

**ลดซ้ำซ้อน**:
- รวม helper `download()` แยกเป็น `src/lib/download.ts` (ใส่ BOM อัตโนมัติสำหรับ CSV)
- ใน `_protected.dashboard.tsx` มี `XLSX.utils.json_to_sheet → sheet_to_csv → download` ซ้ำ 2 ที่ → รวมเป็น helper `exportRowsAsCSV(rows, filename)`

**Security review** (ทำในโหมด default):
- รัน `security--run_security_scan` + `supabase--linter` แล้วรายงานผล
- ตรวจ RLS policies: ตอนนี้ทุกตาราง (`categories`, `employees`, `steps`, `production_logs`) เปิด public read/write ทั้งหมด — เป็นความเสี่ยงหลัก แต่เป็น design choice ของแอพ (ไม่มี user auth ฝั่งพนักงาน) จะ **รายงานให้ทราบ ไม่แก้** เว้นแต่ผู้ใช้สั่ง เพราะแก้แล้วพนักงานจะใช้งานไม่ได้
- ตรวจ `verifyAdminPassword` ฝั่ง server function ว่าเปรียบเทียบ password อย่างปลอดภัย (timing-safe) — ถ้ายังไม่ใช่ จะปรับให้ใช้ `timingSafeEqual`
- ลบ console.log ที่อาจรั่วข้อมูลถ้ามี

## ไฟล์ที่จะแก้

- `src/routes/_protected.dashboard.tsx` — BOM + หัวคอลัมน์ไทย + รวม helper
- `src/lib/i18n.tsx` — ลดเหลือไทยอย่างเดียว
- `src/routes/__root.tsx` — ลบ `I18nProvider`
- `src/routes/index.tsx` — ลบปุ่มเปลี่ยนภาษา
- `src/components/LanguageSwitcher.tsx` — ลบ
- `src/lib/download.ts` — สร้างใหม่ (helper)
- `src/server/admin.functions.ts` — ตรวจ + เพิ่ม timing-safe compare ถ้ายังไม่มี

## สิ่งที่จะ "ไม่" ทำ

- ไม่แก้ RLS เป็น authenticated-only (จะทำให้พนักงานใช้ไม่ได้) — แค่รายงาน
- ไม่ลบฟีเจอร์ note/photo/category/history
