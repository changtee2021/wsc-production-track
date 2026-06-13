# WSC Production — Vercel cutover (Monday go-live)

**Production URL:** `https://wsc-production-track.vercel.app`  
**Archive (read-only, ~1 month):** `https://wsc-production-track.lovable.app` — **do not change Lovable env**

---

## Status (2026-06-13)

| Item | Status |
|------|--------|
| ERP `wsc_production` data import from Lovable backup | **Done** — 38,407 rows, all manifest checks OK |
| `production-intake` route on Vercel | **Done** |
| Vercel deploy + `nitro: true` in `vite.config.ts` | **Done** — health 200 |
| Integrations → Vercel URLs | **Done** — wsc-backoffice, portal, changtee-curatin-traker |
| `PRODUCTION_INTAKE_SECRET` on Vercel | **Done** (wsc-production-track + wsc-backoffice) |
| Lovable left untouched | **Yes** |

### Import command (re-run if needed)

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"
node import-wsc-backup-sql.mjs --truncate
```

Backup folder: `wp-group-erp/backups/wsc-backup-20260613-0617/`  
Scripts: `import-wsc-backup-sql.mjs`, `wsc-backup-fix-stub-tables.sql`, `wsc-backup-missing-tables.sql`

---

## Tonight runbook (13–14 Jun)

Step-by-step checklist for finishing before Monday: **[WSC-MONDAY-GO-LIVE-TONIGHT.md](./WSC-MONDAY-GO-LIVE-TONIGHT.md)**

---

## Before Monday — manual checklist

1. **PINs on Vercel** — set `ADMIN_PASSWORD` and `PACKING_PASSWORD` on `wsc-production-track` (same values staff use on Lovable today). Empty in local `.env` — must be set in Vercel dashboard or CLI.
2. **Optional:** `CURTAIN_FLOW_API_KEY` on Vercel + `changtee-curatin-traker` if Curtain Flow → production jobs is used.
3. **LINE tokens** — copy from Lovable secure note if daily LINE reports are required Monday.
4. Smoke test on `https://wsc-production-track.vercel.app`:
   - `GET /api/public/health` → `{ ok: true }`
   - Admin / packing PIN login
   - Employee list (30 names)
   - QC checklists (26) / packing checklists (11)
   - New production scan writes to ERP
5. **wsc-backoffice** — approve a test order → `production-intake` on Vercel

---

## Architecture

```
Staff (Monday) → wsc-production-track.vercel.app → ERP wsc_production
Archive        → wsc-production-track.lovable.app → legacy ylipwbnoyipzqfivmpjk
wsc-backoffice → POST /api/public/production-intake (Vercel)
changtee       → POST /api/public/curtain-flow/jobs (Vercel)
```

**Never:** switch Lovable Cloud env to ERP (breaks archive).

---

## Staff message (Monday 15 Jun)

**English**

> WSC Production Flow — new link from Monday:  
> **https://wsc-production-track.vercel.app**  
> Use this for all daily work (scan, QC, packing, stock).  
> Old Lovable link stays for viewing history only:  
> https://wsc-production-track.lovable.app  
> PINs are the same as before.

**ไทย**

> ตั้งแต่วันจันทร์ ใช้ลิงก์ใหม่นี้ทำงานประจำวัน:  
> **https://wsc-production-track.vercel.app**  
> (สแกนงาน / QC / แพ็ค / เช็คสต๊อก)  
> ลิงก์ Lovable เดิมเก็บไว้ดูประวัติอย่างเดียว ~1 เดือน  
> รหัส PIN ใช้เหมือนเดิม

---

## Rollback

If Vercel is broken Monday morning:

1. Staff use Lovable link temporarily (unchanged, legacy DB).
2. Fix Vercel; re-import from backup if ERP data needs reset.
3. **Do not** switch Lovable env as rollback.

---

## Storage / avatars

Employee `avatar_url` values still point at legacy public storage (`ylipwbnoyipzqfivmpjk.supabase.co`). Photos load while the Lovable project stays up. Copy `avatars` bucket to ERP later when legacy service role is available (`storage/download-storage.mjs` in backup).
