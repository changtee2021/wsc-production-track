# Deploy wsc-production-track on Vercel

**Production URL (พนักงานใช้):** https://wsc-production-track.vercel.app  
**Archive (ดูประวัติอย่างเดียว):** https://wsc-production-track.lovable.app — **ห้ามเปลี่ยน Lovable env**

---

## ใช้ Vercel project ไหน (สำคัญ — อ่านก่อน deploy)

| | **ถูก (production จริง)** | **ผิด — อย่าใช้** |
|---|---|---|
| Vercel account / team | **`changtee2021`** | `passawutaplus-9338` / passawutaplus-9338s-projects |
| Project name | `wsc-production-track` | project ชื่อเดียวกันแต่อยู่คนละ team |
| Domain | `wsc-production-track.vercel.app` | `wsc-production-track-murex.vercel.app`, `…-passawutaplus-….vercel.app` |
| Git | เชื่อม `changtee2021/wsc-production-track` แล้ว | — |

**กฎ:** Push `main` → Vercel ของ **changtee2021** deploy อัตโนมัติ  
**ไม่ต้อง** `vercel deploy` ไป passawutaplus อีก — จะได้ preview URL คนละตัว แต่ **ไม่** อัปเดตลิงก์ที่พนักงานใช้

### ทำไมเคยหลง (Jun 2026)

- โค้ด fix อยู่บน GitHub `main` แล้ว แต่ production ค้าง commit เก่า เพราะ deploy ไป **passawutaplus** แทน **changtee2021**
- ตอนนั้น project ยัง **ไม่ได้ Connect Git** — push ไม่ trigger deploy
- แก้โดย Connect Git บน dashboard `changtee2021` แล้ว push `main` อีกครั้ง

---

## ครั้งหลัง deploy ยังไง (ปกติ)

```powershell
cd "C:\Users\Admin\WP GROUP\wsc-production-track"

# 1) ทดสอบ build ก่อน (แนะนำ)
npm run build

# 2) commit + push main
git push origin main
```

Vercel (`changtee2021` / `wsc-production-track`) จะ build และ promote production เอง

### ตรวจว่าขึ้นจริง

1. Dashboard: https://vercel.com — team **changtee2021** → `wsc-production-track` → Production deployment ตรง commit ล่าสุด
2. Health: `GET https://wsc-production-track.vercel.app/api/public/health` → `{ "ok": true }`
3. โค้ดใหม่ขึ้น (ตัวอย่าง): เปิด `/qc` แล้วดู Network ว่าโหลด `qc-*.js` ที่ import `direct-video-upload` (ไม่ใช่ bundle เก่าที่ส่งวิดีโอ base64 อย่างเดียว)

---

## ถ้า push แล้ว production ไม่เปลี่ยน

1. เช็ค Vercel → Deployments — build fail หรือไม่
2. เช็คว่าแก้บน **repo ถูก** (`changtee2021/wsc-production-track`) และ branch **`main`**
3. Redeploy มือ: Vercel dashboard → Production → **Redeploy** (ยังอยู่ team changtee2021)
4. **อย่า** `vercel link` แล้ว deploy ด้วย CLI ที่ login เป็น passawutaplus — จะไปผิด project อีก

### Trigger deploy หลัง Connect Git (ครั้งแรก)

ถ้า `main` มี commit เก่าอยู่แล้วก่อน Connect Git อาจต้อง push อีกครั้ง:

```powershell
git commit --allow-empty -m "chore: trigger Vercel production deploy"
git push origin main
```

---

## Vercel project settings (อ้างอิง)

| Setting | ค่า |
|---------|-----|
| GitHub repo | `changtee2021/wsc-production-track` |
| Production branch | `main` |
| Framework | TanStack Start (หรือ Other + build ด้านล่าง) |
| Build Command | `npm run build` |
| Install Command | `npm install --legacy-peer-deps` |
| Region | `sin1` (ใน `vercel.json`) |
| `NITRO_PRESET` | `vercel` |

รายละเอียดเพิ่มใน repo root: `vercel.json`

---

## Environment variables

- ตั้งบน Vercel dashboard → project **changtee2021 / wsc-production-track** → Settings → Environment Variables
- คัดลอกจาก `.env.example` — secret ฝั่ง server **ไม่** ใส่ prefix `VITE_`
- `VITE_SUPABASE_SCHEMA=wsc_production`, `SUPABASE_SCHEMA=wsc_production`
- อย่า commit `.env` (มีใน `.gitignore`)

สคริปต์ push env (ถ้ามี `.env` local):

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"
.\push-vercel-env.ps1 -Repo wsc-production-track -Target production -UseProductionUrls
```

**หมายเหตุ:** รันสคริปต์ต้อง `vercel link` ไป project **changtee2021** ไม่ใช่ passawutaplus

---

## CLI (ใช้เมื่อจำเป็นเท่านั้น)

ใช้เมื่อต้อง deploy มือหรือดึง env — **ต้อง login / link ถูก team**

```powershell
cd "C:\Users\Admin\WP GROUP\wsc-production-track"
npx vercel login          # account changtee2021
npx vercel link           # เลือก changtee2021 → wsc-production-track
npm run build
npx vercel deploy --prod  # เฉพาะกรณีไม่ใช้ Git auto-deploy
```

ถ้า `vercel whoami` เป็น `passawutaplus-9338` และ `vercel link` ไป project นี้ → **ผิด project**

---

## Local verify

```bash
npm run build
npm run preview
```

---

## ลิงก์ที่เกี่ยวข้อง

- Cutover / go-live: [WSC-CUTOVER-PREP.md](./WSC-CUTOVER-PREP.md)
- Production URLs ทั้งกลุ่ม: `wpgroup-portal/src/lib/vercel-urls.ts`
