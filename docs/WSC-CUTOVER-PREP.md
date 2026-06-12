# WSC Production — Cutover prep checklist

**Scope:** `wsc-production-track` only · stay on `https://wsc-production-track.lovable.app`

## Safety rules (read first)

| Safe now (prep)                                                         | Cutover night only                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Schema/RLS on **ERP** (`erpzxusskbtdxvqadwxv`) — empty `wsc_production` | Pause `INTEGRATIONS_ENABLED=false` on wsc-backoffice     |
| Read-only checks, local `npm run build`                                 | Fresh `pg_dump` from **legacy** (`ylipwbnoyipzqfivmpjk`) |
| Trial import → then **truncate** before go-live                         | Import data → switch Lovable env → Publish               |
| Document/copy secrets locally                                           | Re-enable integrations after smoke test                  |

**Never during prep:** change Lovable Cloud production env (`VITE_SUPABASE_*`) — that switches the live app to a different DB.

---

## Prep status (auto-check)

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"
.\wsc-prep-status.ps1
```

---

## Already done (prep session)

- [x] ERP `wsc_production`: **34 tables**, **37 policies**, **0 rows** (schema ready, live app untouched)
- [x] `prep-cutover.ps1`: all 10 repos local env → ERP project
- [x] `npm run build` in `wsc-production-track` — passes
- [x] Live homepage `https://wsc-production-track.lovable.app/` — **200 OK**
- [x] `ERP_DATABASE_URL` in `wp-group-erp/.env.local`
- [x] PostgreSQL 17 client at `C:\Program Files\PostgreSQL\17\bin\psql.exe`

## Still before cutover night

- [ ] Add legacy pooler to `wp-group-erp/.env.local`:
  ```powershell
  node scripts/find-pooler.mjs ylipwbnoyipzqfivmpjk YOUR_LEGACY_DB_PASSWORD
  # → WSC_PRODUCTION_DATABASE_URL=postgresql://...
  ```
- [ ] **Publish** current branch in Lovable (same env — no DB switch) so `/api/public/health` works  
      Today health returns 404 (old deploy); homepage still works.
- [ ] Copy Lovable secrets to a secure note (values for cutover night paste):
  - `ADMIN_PASSWORD`, `PACKING_PASSWORD`
  - `LINE_*`, `WSC_REPORTS_SECRET`, `CURTAIN_FLOW_API_KEY`, `LOVABLE_API_KEY`
  - ERP keys: `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Confirm wsc-backoffice `PRODUCTION_INTAKE_SECRET` matches wsc-production-track
- [ ] Plan storage copy: buckets `qc-media`, `packing-media`, `log-notes` (legacy → ERP)

---

## Cutover night runbook (~2–3 h if prep complete)

Reference: [ERP-CUTOVER.md](./ERP-CUTOVER.md)

```
20:00  INTEGRATIONS_ENABLED=false  (wsc-backoffice Lovable Cloud)
20:10  pg_dump legacy → backups/wsc-production-legacy-YYYYMMDD.sql
20:30  Import → wsc_production on ERP (verify row counts)
21:00  Copy storage files (if any)
21:30  Update Lovable env (ERP URL + schema wsc_production + keys)
       APP_PUBLIC_URL stays https://wsc-production-track.lovable.app
21:45  Publish in Lovable
22:00  Smoke test (below)
22:30  INTEGRATIONS_ENABLED=true
23:00  Go / rollback decision
```

### Smoke test

1. `GET /api/public/health` → `{ ok: true }`
2. Admin / packing PIN login
3. Production scan + QC + stock count
4. Curtain Flow → job appears
5. wsc-backoffice → production intake (test order)
6. LINE notify (if used)

### Rollback (if broken after env switch)

1. Revert Lovable env to **legacy** Supabase project + Publish (~15 min)
2. `INTEGRATIONS_ENABLED=true` on wsc-backoffice
3. Legacy DB unchanged — employees can work again

---

## Verify row counts after import

```sql
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'wsc_production'
ORDER BY n_live_tup DESC
LIMIT 20;
```

Compare key tables vs legacy (employees, production_logs, qc_reports, production_jobs).
