## เป้าหมาย
เพิ่มหน้าใหม่ `สรุป QC` ที่แสดงสถิติงาน QC แบบ **รายวัน** และ **รายเดือน** พร้อมกราฟ — ผ่าน/ไม่ผ่าน, จำนวนรวม, แยกตามหมวด

## หน้าใหม่: `/qc-summary`

### ส่วนหัว / ตัวกรอง
- เลือกโหมด: **รายวัน** (default, ช่วง 30 วันล่าสุด) / **รายเดือน** (12 เดือนล่าสุด)
- เลือกช่วงวันที่เอง (from / to)
- ปุ่ม Refresh

### การ์ดสรุป (KPI) 4 ใบ
- งาน QC ทั้งหมด
- ✅ ผ่าน (จำนวน + %)
- ❌ ไม่ผ่าน (จำนวน + %)
- ⏳ ยังไม่ระบุผล (overall_result เป็น null)

### กราฟ
1. **Bar chart (stacked)** — แกน X เป็นวัน/เดือน, แท่งสีเขียว=ผ่าน / สีแดง=ไม่ผ่าน / สีเทา=ไม่ระบุ
2. **Pie chart** — สัดส่วน ผ่าน/ไม่ผ่าน/ไม่ระบุ รวมทั้งช่วง
3. **Bar chart แนวนอน** — แยกตามหมวด (มู่ลี่ไม้/อลู/ม่านม้วน/ม่านปรับแสง) แสดงผ่าน vs ไม่ผ่าน

### ตารางสรุป
- คอลัมน์: วัน/เดือน • รวม • ผ่าน • ไม่ผ่าน • ไม่ระบุ • อัตราผ่าน(%)

## เทคนิค

### 1. Server function ใหม่ใน `src/lib/admin.functions.ts`
`adminFetchQcSummary({ token, from, to, granularity: 'day' | 'month' })`
- Query `qc_reports`: `id, created_at, overall_result, category_id, categories(name)`
- Filter ตาม `from`/`to`
- Group ฝั่ง JS ตาม `granularity` (วัน=`YYYY-MM-DD`, เดือน=`YYYY-MM`) เป็น buckets
- คืน:
  ```ts
  {
    buckets: [{ key, total, pass, fail, unknown }],
    byCategory: [{ category, total, pass, fail, unknown }],
    totals: { total, pass, fail, unknown },
  }
  ```

### 2. หน้า `src/routes/_protected.qc-summary.tsx`
- ใช้ `recharts` (มีอยู่แล้วในโปรเจค dashboard)
- โหลดผ่าน `useServerFn` + state filters
- token ผ่าน `requireToken()` (รูปแบบเดียวกับ qc-reports)
- ธีมสีใช้ semantic tokens จาก `styles.css`

### 3. เพิ่มเมนู sidebar
ใน `src/components/AdminSidebar.tsx` เพิ่มรายการใหม่หลัง "รายงาน QC":
```
{ title: "สรุป QC", url: "/qc-summary", icon: BarChart3 }
```

### 4. system_logs INSERT
บันทึก: "เพิ่มหน้าสรุป QC รายวัน/รายเดือน พร้อมกราฟ" — category: feature

## ไฟล์ที่เปลี่ยน
- `src/lib/admin.functions.ts` (เพิ่ม `adminFetchQcSummary`)
- `src/routes/_protected.qc-summary.tsx` (ใหม่)
- `src/components/AdminSidebar.tsx` (เพิ่มเมนู)
- `system_logs` INSERT
