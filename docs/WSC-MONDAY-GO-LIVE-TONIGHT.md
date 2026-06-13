# WSC Monday go-live — คืนนี้ (13–14 มิ.ย. 2026)

**เป้าหมาย:** จบคืนนี้ → จันทร์ 15 มิ.ย. พนักงานแค่เปิดลิงก์ใหม่  
**Production URL:** https://wsc-production-track.vercel.app  
**Archive (ดูประวัติอย่างเดียว):** https://wsc-production-track.lovable.app — **ห้ามเปลี่ยน Lovable env**

เวลาโดยประมาณ: **2–3 ชม.** (เริ่ม ~20:00–21:00)

Related: [WSC-CUTOVER-PREP.md](./WSC-CUTOVER-PREP.md) · [ERP-CUTOVER.md](./ERP-CUTOVER.md)

---

## ทำแล้ว — ไม่ต้องทำซ้ำ

- [x] Import ERP `wsc_production` (38,407 rows)
- [x] Vercel deploy + `/api/public/health` 200
- [x] `production-intake` route
- [x] `PRODUCTION_INTAKE_SECRET` (wsc-production-track + wsc-backoffice)
- [x] Integrations → Vercel URLs
- [x] Lovable archive ไม่แตะ env

---

## คืนนี้ต้องจบ (Go-live gate)

- [ ] Backup ERP วันนี้
- [ ] Commit + deploy โค้ดค้าง (ถ้ามี)
- [ ] PIN + LINE บน Vercel
- [ ] Smoke test ครบ
- [ ] wsc-backoffice → production-intake ผ่าน
- [ ] ข้อความแจ้งพนักงานพร้อม (ส่งจันทร์เช้า)

**ไม่ทำคืนนี้ (ไม่ block จันทร์):** อีเมล Resend, Portal LINE IT, cutover 10 แอป, copy storage avatars

---

## Phase 0 — Backup (~15 นาที)

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"
.\backup-erp-schemas.ps1
```

- [ ] สำเร็จ — โฟลเดอร์ `wp-group-erp/backups/YYYYMMDD-HHmmss/`
- [ ] มีไฟล์ `wsc_production.sql`

**Rollback:** re-import จาก backup นี้ถ้า ERP data พัง

---

## Phase 1 — โค้ดค้าง + Deploy (~45–60 นาที)

### Repos ที่อาจค้าง (เช็ค `git status`)

| Repo | ไฟล์ |
|------|------|
| `wsc-production-track` | `production-intake`, `vite.config.ts`, docs |
| `wsc-backoffice` | `src/lib/production-forward.server.ts` |

### Build ก่อน push

```powershell
cd "C:\Users\Admin\WP GROUP\wsc-production-track"
npm run lint
npm run build

cd "C:\Users\Admin\WP GROUP\wsc-backoffice"
npm run lint
npm run build
```

- [ ] Build ผ่านทั้งสอง repo
- [ ] Commit + push (หรือให้ Agent ช่วยใน Cursor)
- [ ] Vercel Production deployment **green** ทั้งสอง project

### Optional fix (ถ้ายัง default Lovable)

ไฟล์ `wsc-production-track/src/lib/app-public-url.ts` — default ควรเป็น Vercel หรือตั้ง env `APP_PUBLIC_URL` / `VITE_APP_PUBLIC_URL` บน Vercel แล้ว

---

## Phase 2 — Vercel env (~20 นาที)

Vercel → **wsc-production-track** → Settings → Environment Variables → **Production**

| Variable | ค่า | บังคับ |
|----------|-----|--------|
| `ADMIN_PASSWORD` | เหมือน Lovable วันนี้ | ✅ |
| `PACKING_PASSWORD` | เหมือน Lovable วันนี้ | ✅ |
| `LINE_CHANNEL_ACCESS_TOKEN` | จาก Lovable secure note | ถ้าใช้ LINE จันทร์ |
| `LINE_*` อื่นๆ | copy จาก Lovable | ตามที่แอปใช้ |
| `CURTAIN_FLOW_API_KEY` | — | optional (changtee → jobs) |

ตรวจว่ามีอยู่แล้ว:

- [ ] `VITE_SUPABASE_URL` → `https://erpzxusskbtdxvqadwxv.supabase.co`
- [ ] `VITE_SUPABASE_SCHEMA=wsc_production`
- [ ] `SUPABASE_SCHEMA=wsc_production`
- [ ] `PRODUCTION_INTAKE_SECRET` (คู่กับ wsc-backoffice)

**หลังใส่/แก้ env → Redeploy Production**

- [ ] Redeploy แล้ว — deployment ล่าสุด green

---

## Phase 3 — Smoke test (~30–45 นาที)

Base: https://wsc-production-track.vercel.app

### 3.1 API

```powershell
curl -s https://wsc-production-track.vercel.app/api/public/health
```

- [ ] ได้ JSON `{ "ok": true }` (หรือเทียบเท่า)

### 3.2 UI / PIN

- [ ] Admin PIN login ผ่าน
- [ ] Packing PIN login ผ่าน
- [ ] รายชื่อพนักงาน ~30 คน
- [ ] QC checklists ~26
- [ ] Packing checklists ~11

### 3.3 เขียนข้อมูล ERP

- [ ] สแกน/บันทึกงานใหม่ 1 รายการ
- [ ] ตรวจใน Supabase schema `wsc_production` ว่ามี row ใหม่

### 3.4 LINE (ถ้าใช้)

- [ ] ส่งรายงานทดสอบ 1 ครั้ง — ข้อความเข้ากลุ่ม/แชทที่คาด

**หมายเหตุ:** รูป avatar อาจโหลดจาก legacy storage — OK ตราบ Lovable archive ยัง up

---

## Phase 4 — Integration test (~15 นาที)

1. เปิด https://wsc-backoffice.vercel.app
2. อนุมัติออเดอร์ทดสอบ WSC 1 รายการ
3. ตรวจ job ปรากฏใน wsc-production-track (Vercel)

- [ ] backoffice → `production-intake` บน Vercel **ผ่าน**

**ถ้า fail ตรวจ:**

| จุด | ค่าที่ถูก |
|-----|-----------|
| wsc-backoffice `INTEGRATIONS_ENABLED` | `true` |
| wsc-backoffice `PRODUCTION_INTAKE_URL` | `https://wsc-production-track.vercel.app/api/public/production-intake` |
| Secret | ตรงกันทั้ง wsc-backoffice + wsc-production-track |

---

## Phase 5 — Sign-off + ข้อความพนักงาน (~10 นาที)

### Go / No-Go

| เงื่อนไข | ✓ |
|----------|---|
| Backup วันนี้ | |
| Smoke test ครบ | |
| backoffice → intake ผ่าน | |
| PIN บน Vercel แล้ว | |

**No-Go จันทร์เช้า:** staff ใช้ Lovable ชั่วคราว → แก้ Vercel → สลับลิงก์อีกครั้ง (อย่าเปลี่ยน Lovable env)

### ส่งพนักงานจันทร์เช้า (copy-paste)

**ไทย**

> ตั้งแต่วันจันทร์ ใช้ลิงก์ใหม่นี้ทำงานประจำวัน:  
> **https://wsc-production-track.vercel.app**  
> (สแกนงาน / QC / แพ็ค / เช็คสต๊อก)  
> ลิงก์ Lovable เดิมเก็บไว้ดูประวัติอย่างเดียว ~1 เดือน  
> รหัส PIN ใช้เหมือนเดิม

**English**

> WSC Production Flow — new link from Monday:  
> **https://wsc-production-track.vercel.app**  
> Use this for all daily work (scan, QC, packing, stock).  
> Old Lovable link stays for viewing history only:  
> https://wsc-production-track.lovable.app  
> PINs are the same as before.

- [ ] ข้อความ copy ไว้แล้ว / ตั้งเวลาส่ง LINE กลุ่มพนักงาน

---

## Rollback (ถ้าจันทร์เช้าพัง)

1. Staff ใช้ https://wsc-production-track.lovable.app ชั่วคราว (legacy DB ไม่เปลี่ยน)
2. แก้ Vercel / re-import จาก backup ถ้าต้อง reset ERP
3. **ห้าม** switch Lovable Cloud env เป็น ERP เป็น rollback

Re-import (ถ้าจำเป็น):

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"
node import-wsc-backup-sql.mjs --truncate
```

Backup ล่าสุด: `wp-group-erp/backups/wsc-backup-20260613-0617/` (หรือ backup คืนนี้จาก Phase 0)

---

## Cursor Agent — คำสั่งเริ่ม (ถ้าต้องการช่วย)

เปิด Agent mode แล้วส่ง:

> ทำตาม WSC-MONDAY-GO-LIVE-TONIGHT.md Phase 1: commit+deploy โค้ดค้าง wsc-production-track และ wsc-backoffice, แก้ app-public-url default เป็น vercel ถ้ายังเป็น lovable, รัน build ให้ผ่าน, สรุป env ที่ยังขาดบน Vercel

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Ops | | | Backup + Vercel env |
| Dev | | | Deploy + smoke |
| Go-live | | | จันทร์ 15 มิ.ย. — ส่งลิงก์ Vercel |
