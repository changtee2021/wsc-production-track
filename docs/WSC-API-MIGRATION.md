# WSC migration without legacy DB password

Lovable does not expose the Postgres password for project `ylipwbnoyipzqfivmpjk`.
Use **API migration** instead of `pg_dump`.

## What you need from Lovable Cloud

Open **wsc-production-track** → **Settings** → **Environment variables** and copy:

| Lovable env var | Put in `wp-group-erp/.env.local` |
|-----------------|----------------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `WSC_LEGACY_SERVICE_ROLE_KEY=` |
| `WSC_REPORTS_SECRET` | `WSC_REPORTS_SECRET=` (for pull via Lovable server) |

Do **not** commit these values.

## Option A — Direct API (fastest if you have service role key)

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"

# 1) Paste WSC_LEGACY_SERVICE_ROLE_KEY into ..\.env.local

# 2) Probe (see row counts)
.\run-wsc-migration.ps1 probe

# 3) Export + import into ERP wsc_production (after hours)
.\run-wsc-migration.ps1 run -Truncate
```

Scripts: `migrate-wsc-production.mjs`  
- Auto-fetches **anon** key from live `wsc-production-track.lovable.app` if no service role (partial only).  
- **Service role** exports all tables (bypasses RLS).

## Option B — Pull via Lovable server (if service role not copyable)

Uses Lovable’s server-side `SUPABASE_SERVICE_ROLE_KEY` — you only need `WSC_REPORTS_SECRET`.

1. **Publish** current `wsc-production-track` in Lovable (adds `/api/public/migration-export`).
2. Add `WSC_REPORTS_SECRET` to `wp-group-erp/.env.local`.
3. Run:

```powershell
cd "C:\Users\Admin\WP GROUP\wp-group-erp\scripts"
.\run-wsc-migration.ps1 pull-lovable
node ..\scripts\migrate-wsc-production.mjs import --dir=..\backups\wsc-lovable-export-YYYYMMDD --truncate
```

## After data import

1. Update Lovable env to ERP (`erpzxusskbtdxvqadwxv`, schema `wsc_production`).
2. Publish again.
3. Smoke test (see `WSC-CUTOVER-PREP.md`).

## Storage (images)

API migration does **not** copy `qc-media`, `packing-media`, `log-notes` files.  
Plan a separate storage copy once service role keys for legacy + ERP are available.

## Probe result (anon only, 2026-06-13)

Anon key can read setup tables (employees, steps, checklists) but **not** full production history.  
`production_logs`, `qc_reports`, etc. need **service role** or Option B.
