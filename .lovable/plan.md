# Plan

## 1. QC employee avatar upload (`src/routes/_protected.manage.tsx`)

Mirror the pattern already used in the regular Employees panel (line ~247):

- Add `avatar_url` column to `qc_employees` table via migration (nullable text).
- Extend `adminUpsertQcEmployee` server fn in `src/lib/admin.functions.ts` to accept optional `avatar_url`.
- In `QcEmployeesPanel`:
  - Add `avatarUrl` state + file input that calls `adminUpload("avatars", file, createUrl)` (reuses existing `avatars` bucket and `adminCreateUploadUrl`).
  - Show `<Avatar>` preview next to the inputs (same UX as Employees panel).
  - Pass `avatar_url` on insert/update; populate on edit.
  - Render avatar thumbnail in the list rows.
- Update `QcEmp` type to include `avatar_url`.

## 2. Dashboard report layout (`src/routes/_protected.dashboard.tsx`, lines ~1493–1625)

Two affected `Section`s:
- "จำนวนงานต่อพนักงาน — แยกตามขั้นตอน"
- "เวลาเฉลี่ยต่อพนักงาน — แยกตามขั้นตอน"

Inside each category card, the steps list currently uses `grid gap-4` (single column). Change to:
```
grid gap-4 md:grid-cols-1 lg:grid-cols-2
```
so PC (≥1024px) shows 2 columns side-by-side, tablet/mobile stays single column.

## 3. Mobile UI tightening (same two sections + their wrappers)

- Reduce chart height on mobile: `height={420}` → use responsive value (e.g. `h-[280px] sm:h-[360px] lg:h-[420px]` via wrapper div instead of fixed `height` prop, or branch via `useIsMobile`). Use a wrapper `<div className="h-[280px] sm:h-[380px] lg:h-[420px]">` with `ResponsiveContainer width="100%" height="100%"`.
- Reduce pie `outerRadius` on mobile (110 mobile / 150 desktop) by reading `useIsMobile()` already imported in dashboard if present, else add it.
- Tighten paddings on mobile: `p-4` → `p-3 sm:p-4` on the category wrapper and inner step card; `gap-4` → `gap-3 sm:gap-4`.
- Make the per-category header stack on small screens: `flex items-center justify-between` → `flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between`.
- Shrink legend font on mobile via `wrapperStyle={{ fontSize: 10 }}` (already 11).

No business-logic changes; only layout/styling and one schema column + serverFn field.

## Files to edit
- `supabase/migrations/<new>.sql` — `ALTER TABLE qc_employees ADD COLUMN avatar_url text;`
- `src/lib/admin.functions.ts` — add `avatar_url` to `qcEmployeePayload`, include in upsert row.
- `src/routes/_protected.manage.tsx` — avatar upload UI in `QcEmployeesPanel`.
- `src/routes/_protected.dashboard.tsx` — `lg:grid-cols-2` + responsive heights/paddings in the two report sections.
