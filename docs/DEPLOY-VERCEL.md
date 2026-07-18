# Deploy wsc-production-track on Vercel

## Prerequisites

- Supabase ERP project `erpzxusskbtdxvqadwxv` with schema `wsc_production`
- Node 20+

## Vercel project settings

1. Import GitHub repo `changtee2021/wsc-production-track`
2. Framework Preset: **Other**
3. Build Command: `npm run build`
4. Install Command: `npm install --legacy-peer-deps`
5. Output: Nitro/Vercel output from TanStack Start (see build logs)

## Environment variables

Copy from `.env.example`. Server secrets must **not** use `VITE_` prefix.

Set `VITE_SUPABASE_SCHEMA=wsc_production` and `SUPABASE_SCHEMA=wsc_production`.

During legacy ERP cutover, set `ERP_CUTOVER_PENDING=true` after hours to pause outbound integrations.

For Vercel + TanStack Start, set Nitro preset if needed:

```bash
NITRO_PRESET=vercel
```

## Local verify

```bash
npm run build
npm run preview
```

Lovable Cloud deploy remains supported; Vercel is an optional secondary host.
