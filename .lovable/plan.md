## Gamified Production Scoring & Leaderboard

ระบบให้คะแนนพนักงานอัตโนมัติจากเวลาที่ใช้ทำแต่ละขั้นตอน เทียบกับมาตรฐานที่แอดมินตั้งไว้ — แยกตามหมวด/ขั้นตอน พร้อม Leaderboard และ Badge

---

### 1) Database (migration)

ตารางใหม่:

- **`production_standards`** — เกณฑ์เวลามาตรฐานต่อ (category, step)
  - `category_id`, `step_id` (UNIQUE คู่กัน, category_id nullable = ใช้ได้ทุกหมวด)
  - `target_seconds` (int) — เวลามาตรฐานเป็นวินาที
  - `fast_seconds` (int, nullable) — เกณฑ์โบนัส "โคตรเร็ว"
  - `on_time_points`, `late_points`, `bonus_points` (int)
  - `active` (bool)

- **`employee_scores`** — บันทึกคะแนนรายครั้ง (1 แถว = 1 รอบงาน start→finish)
  - `employee_id`, `job_id`, `step_id`, `category_id`
  - `start_log_id`, `finish_log_id` (FK → production_logs)
  - `actual_seconds` (int), `target_seconds` (int)
  - `points` (int), `tier` (enum: `bonus` | `on_time` | `late`)
  - `scored_at` (timestamptz)
  - UNIQUE (finish_log_id) เพื่อกัน insert ซ้ำ

- **`employee_badges`** — เหรียญที่ได้รับ
  - `employee_id`, `badge_code` (เช่น `flash`, `precision`, `streak_7`)
  - `awarded_at`, `meta jsonb`

Trigger / RPC:
- ฟังก์ชัน `fn_score_on_finish()` — รัน AFTER INSERT บน `production_logs` เมื่อ `action='finish'`:
  หา start log ล่าสุดของ (job_id, step_id, employee_id) ที่ยังไม่ถูก score → คำนวณ `actual_seconds` → match `production_standards` → insert `employee_scores`
- ฟังก์ชัน `fn_award_badges()` — ตรวจเงื่อนไข badge หลัง insert คะแนน

GRANT + RLS:
- `production_standards`: anon SELECT (แอปคนงานต้องอ่านได้), service_role ALL
- `employee_scores`, `employee_badges`: anon SELECT (Leaderboard เปิดให้คนงานดูได้), service_role ALL

---

### 2) Server functions

**`src/lib/scoring-admin.functions.ts`** (ต้องมี admin token)
- `adminListStandards({ category_id?, step_id? })`
- `adminUpsertStandard(...)`
- `adminDeleteStandard(id)`
- `adminScoringOverview({ range })` — สรุปจำนวน on_time/late, ขั้นตอนที่ late บ่อย (bottleneck)

**`src/lib/scoring.functions.ts`** (public read)
- `getLeaderboard({ range: 'today'|'week'|'month' })` → top 10 พร้อม avatar, points, on_time%, badge count
- `getEmployeeScoreSummary({ employee_id, range })` → คะแนนวันนี้/สัปดาห์, สถิติส่วนตัว, badge ล่าสุด
- `getMyRecentScores({ employee_id, limit })`

---

### 3) Admin UI

**Route ใหม่: `/_protected.scoring-standards.tsx`**
- ตารางมาตรฐาน filter ตาม Category + Step
- ปุ่ม "เพิ่มมาตรฐาน" → dialog เลือก category+step, target (นาที:วินาที), fast time, คะแนน 3 ช่อง
- Bulk apply: เลือกหลาย step แล้วใส่เวลาเดียวกัน

**Route ใหม่: `/_protected.scoring-dashboard.tsx`**
- Card: คะแนนรวมทีมวันนี้ / สัปดาห์
- Top 5 พนักงานเดือนนี้ + avatar
- กราฟ "ขั้นตอนเจ้าปัญหา" (top 5 step ที่ late %)
- ตารางคะแนนรายคน (ส่งออก CSV ได้)

เพิ่ม 2 รายการในกลุ่ม "ระบบ" ของ `AdminSidebar`

---

### 4) Worker-facing UI

**Route ใหม่: `/leaderboard`** (public, ไม่ต้องล็อกอิน — เปิดบนจอในโรงงาน)
- Hero: Top 3 podium พร้อมรูป + คะแนน
- ตาราง 4–10
- Toggle: วันนี้ / สัปดาห์ / เดือน
- Auto-refresh 30 วินาที

**ใน `/scan` (หน้าคนงานเดิม)** เพิ่ม widget เล็กๆ หลังกด finish:
- Toast แสดง "+15 คะแนน! ทันเวลา ⚡" หรือ "+25 คะแนน! โคตรเร็ว 🔥"
- ลิงก์ไป `/my-score?emp=<code>` แสดง progress bar เทียบกับเมื่อวาน + badge ล่าสุด

---

### 5) AI Chatbot integration

เพิ่ม tools ใน `src/lib/ai-admin-tools.server.ts`:
- `getLeaderboard(range)`
- `getEmployeeScoreDetail(employeeName, range)`
- `getBottleneckSteps(range)`
- `getStandardsCoverage()` — เช็คว่า step ไหนยังไม่ตั้งมาตรฐาน

อัพเดต system prompt + suggestion chips ใหม่ เช่น "ใครคะแนนสูงสุดสัปดาห์นี้", "ขั้นตอนไหน late บ่อยสุด"

---

### 6) Badges (เริ่มแบบ MVP)

| Code | เงื่อนไข | ไอคอน |
|---|---|---|
| `flash` | ได้ tier=bonus 5 ครั้งติดใน 1 วัน | ⚡ |
| `precision` | finish ผ่านครบทุก step ของ 1 job โดยไม่มี late | 🎯 |
| `streak_7` | ทำงาน on_time+ ทุกวัน 7 วันติด | 🔥 |
| `top_month` | อันดับ 1 ของเดือนที่แล้ว | 👑 |

ตรวจใน trigger หลัง insert score

---

### หมายเหตุเทคนิค

- เวลาเริ่ม/จบดึงจาก `production_logs` (มี action=start/finish อยู่แล้ว) — ไม่ต้องแก้หน้าคนงาน
- การ backfill: หลัง deploy รัน job ครั้งเดียวเพื่อ score logs ย้อนหลัง 30 วัน (optional)
- ใส่ `system_logs` ทุก migration ตามกฎโปรเจกต์

---

### คำถามก่อนเริ่มสร้าง

1. **ขอบเขตคะแนน** — นับเฉพาะ production (สาย start/finish) หรือรวม QC + Packing ด้วย?
2. **Leaderboard** — เปิด public ที่ `/leaderboard` ให้คนงานเปิดดูเอง หรือซ่อนไว้หลัง admin login?
3. **เริ่มทำส่วนไหนก่อน** — (a) Standards + Auto-scoring + Admin dashboard เท่านั้น (MVP) หรือ (b) ลุยครบ Badges + Worker leaderboard + AI tools ทีเดียว?