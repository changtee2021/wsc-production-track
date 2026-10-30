# Daily server-side video compression

Staff upload QC / packing / maintenance videos as usual (no wait). Every workday at **17:30 Asia/Bangkok** GitHub Actions repairs broken MP4 headers and compresses to web-safe H.264, then upserts the **same Storage path** so report rows do not change.

## Tracking table

`wsc_production.video_processing` — one row per `(bucket, path)`.

- Pending: no row, or `status = failed` with `attempts < 3`
- Leftovers from a missed/failed day are processed **oldest first** on the next run

## Local CLI

```bash
# Dry-run (list what would be converted)
npm run videos:convert

# Apply (write)
npm run videos:convert:apply

# Limit / budget / single path
node scripts/server-convert-videos.mjs --apply --bucket=qc-media --limit=5 --budget-min=60
node scripts/server-convert-videos.mjs --apply --bucket=qc-media --path=video/<uuid>.mp4
```

Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SCHEMA=wsc_production` (see `.env.example`) and `ffmpeg` / `ffprobe` on PATH.

## GitHub Actions

Workflow: `.github/workflows/convert-videos.yml`

| Trigger | When |
|--------|------|
| Cron | `30 10 * * 1-6` UTC (= 17:30 ICT Mon–Sat) |
| Manual | Actions → **Convert videos** → Run workflow |

Secrets (repo Settings → Secrets):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SCHEMA` (= `wsc_production`)

A failed convert on any file exits non-zero so the workflow turns red (GitHub email if notifications are on).

## Fallback

Browser background convert after upload and the admin **ดาวน์โหลด** repair dialog in MediaLightbox remain as fallback if a clip is needed before the evening run.
