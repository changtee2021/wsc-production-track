/**
 * Download + convert QC/packing videos for a job id to Downloads.
 * Usage: node scripts/download-job-video.mjs 23ffbb1f
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadEnv() {
  try {
    const envPath = new URL("../.env", import.meta.url);
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(k in process.env) || !process.env[k]) process.env[k] = v;
    }
  } catch (e) {
    console.warn("loadEnv failed:", e.message);
  }
}

function resolveFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    "ffmpeg",
    join(
      process.env.LOCALAPPDATA || "",
      "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe",
    ),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c !== "ffmpeg" && !existsSync(c)) continue;
    const r = spawnSync(c, ["-version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  return null;
}

function collectVideoPaths(media) {
  const paths = [];
  const list = Array.isArray(media) ? media : [];
  for (const m of list) {
    if (!m) continue;
    const url = typeof m === "string" ? m : m.url;
    const type = typeof m === "string" ? "" : m.type;
    if (typeof url !== "string") continue;
    const isVideo =
      type === "video" ||
      /\.(mp4|mov|m4v|webm|qt)$/i.test(url) ||
      url.startsWith("video/");
    if (isVideo) paths.push(url);
  }
  return paths;
}

async function main() {
  loadEnv();
  const jobId = (process.argv[2] || "").trim();
  if (!jobId) {
    console.error("Usage: node scripts/download-job-video.mjs <job_id>");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.VITE_SUPABASE_SCHEMA || process.env.SUPABASE_SCHEMA || "wsc_production";
  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });

  const outDir = join(homedir(), "Downloads", `job-${jobId}`);
  mkdirSync(outDir, { recursive: true });

  const sources = [
    { table: "qc_reports", bucket: "qc-media", extra: "qc_report_items(media)" },
    { table: "packing_reports", bucket: "packing-media", extra: "packing_report_items(media)" },
  ];

  const jobs = [];
  for (const src of sources) {
    const { data, error } = await supabase
      .from(src.table)
      .select(`id, job_id, created_at, media, ${src.extra}`)
      .ilike("job_id", `%${jobId}%`);
    if (error) {
      console.error(`query ${src.table}: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) {
      const paths = new Set(collectVideoPaths(row.media));
      const items = row.qc_report_items || row.packing_report_items || [];
      for (const item of items) {
        for (const p of collectVideoPaths(item.media)) paths.add(p);
      }
      for (const path of paths) {
        jobs.push({ bucket: src.bucket, path, reportId: row.id, table: src.table });
      }
    }
  }

  console.log(`found ${jobs.length} video(s) for job ${jobId}`);
  if (!jobs.length) {
    process.exit(1);
  }

  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) console.warn("ffmpeg not found — will save original only");

  let ok = 0;
  let fail = 0;
  for (const job of jobs) {
    const base = job.path.split("/").pop() || "video.bin";
    const destOrig = join(outDir, `${job.table}-${base}`);
    console.log(`DOWNLOAD ${job.bucket}/${job.path}`);
    const { data: blob, error: dlErr } = await supabase.storage.from(job.bucket).download(job.path);
    if (dlErr || !blob) {
      console.error(`  FAIL download: ${dlErr?.message || "no data"}`);
      fail++;
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    writeFileSync(destOrig, buf);
    console.log(`  saved ${destOrig} (${buf.length} bytes)`);
    ok++;

    if (!ffmpeg) continue;
    const destMp4 = destOrig.replace(/\.(mov|m4v|webm|qt)$/i, ".mp4");
    if (destMp4 === destOrig && /\.mp4$/i.test(destOrig)) {
      // still remux/convert for playback
    }
    const outMp4 = destOrig.replace(/\.[^.]+$/, "") + "-playable.mp4";
    console.log(`  CONVERT → ${outMp4}`);
    const r = spawnSync(
      ffmpeg,
      [
        "-y",
        "-i",
        destOrig,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale='min(1280,iw)':-2",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        outMp4,
      ],
      { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 },
    );
    if (r.status !== 0) {
      console.error(`  FAIL convert: ${(r.stderr || "").slice(-800)}`);
    } else {
      console.log(`  converted ok`);
    }
  }

  console.log(`\nDone. downloaded=${ok} failed=${fail} out=${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
