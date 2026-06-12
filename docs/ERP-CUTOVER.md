# WSC Production — ERP cutover (after hours)

**Do not change production env during business hours.**

## When ready

1. Set `INTEGRATIONS_ENABLED=false` on wsc-backoffice
2. Backup legacy Supabase: `wp-group-erp/scripts/backup-all.ps1`
3. Import data into schema `wsc_production` on project `erpzxusskbtdxvqadwxv`
4. Update Lovable env:
   - `VITE_SUPABASE_URL=https://erpzxusskbtdxvqadwxv.supabase.co`
   - `VITE_SUPABASE_PROJECT_ID=erpzxusskbtdxvqadwxv`
   - `VITE_SUPABASE_SCHEMA=wsc_production`
   - `SUPABASE_SCHEMA=wsc_production`
   - Remove `ERP_CUTOVER_PENDING` or set `false`
5. Restore `PRODUCTION_INTAKE_SECRET` on wsc-backoffice pointing to this app
6. Update `APP_PUBLIC_URL` / `VITE_APP_PUBLIC_URL` to `https://wsc-production-track.vercel.app`
7. Update wsc-backoffice `PRODUCTION_INTAKE_URL` to Vercel intake URL
8. Remove `LOVABLE_BASE_OVERRIDES` for wsc-prod in `wpgroup-portal/src/lib/vercel-urls.ts`
9. Smoke test: scan, QC, stock-count, curtain-flow jobs API

See [wp-group-erp/docs/MIGRATION-RUNBOOK.md](../../wp-group-erp/docs/MIGRATION-RUNBOOK.md).
