/**
 * Backfill existing Storage videos → web-safe H.264 MP4 (in-place upsert).
 *
 * Requires:
 *   - ffmpeg on PATH
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env or .env
 *
 * Usage:
 *   node scripts/backfill-web-safe-videos.mjs              # dry-run
 *   node scripts/backfill-web-safe-videos.mjs --apply      # write
 *   node scripts/backfill-web-safe-videos.mjs --apply --bucket=qc-media
 *   node scripts/backfill-web-safe-videos.mjs --apply --limit=20
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKETS = ["qc-media", "packing-media", "maintenance-media"];
const VIDEO_RE = /\.(mp4|mov|m4v|webm|qt)$/i;
const MAX_BYTES = 500 * 1024 * 1024; // skip huge files in backfill unless forced

function loadEnv() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

function parseArgs(argv) {
  const opts = { apply: false, bucket: null, limit: Infinity, force: false };
  for (const a of argv) {
    if (a === "--apply") opts.apply = true;
    else if (a === "--force") opts.force = true;
    else if (a.startsWith("--bucket=")) opts.bucket = a.slice("--bucket=".length);
    else if (a.startsWith("--limit=")) opts.limit = Number(a.slice("--limit=".length)) || Infinity;
  }
  return opts;
}

function hasHevc(bytes) {
  const n = Math.min(bytes.length, 2 * 1024 * 1024);
  let ascii = "";
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    ascii += c >= 32 && c <= 126 ? String.fromCharCode(c) : ".";
  }
  return ascii.includes("hvc1") || ascii.includes("hev1") || ascii.includes("hevC");
}

function isWebm(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

function isMp4Family(bytes) {
  return bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

function needsConvert(path, bytes) {
  if (VIDEO_RE.test(path) === false && !isMp4Family(bytes) && !isWebm(bytes)) return false;
  if (isWebm(bytes) || /\.webm$/i.test(path)) return true;
  if (/\.(mov|m4v)$/i.test(path)) return true;
  if (isMp4Family(bytes) && hasHevc(bytes)) return true;
  return false;
}

function ensureFfmpeg() {
  const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error("ffmpeg not found on PATH — install ffmpeg before running backfill");
  }
}

function transcodeFile(inputPath, outputPath) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
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
      outputPath,
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    throw new Error(r.stderr?.slice(-800) || "ffmpeg failed");
  }
}

async function listAll(supabase, bucket) {
  const out = [];
  async function walk(prefix) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null && !item.metadata) {
        // folder
        await walk(path);
        continue;
      }
      const size = item.metadata?.size ?? item.metadata?.contentLength ?? 0;
      if (VIDEO_RE.test(item.name) || String(item.metadata?.mimetype || "").startsWith("video/")) {
        out.push({ path, size: Number(size) || 0 });
      }
    }
  }
  await walk("video");
  await walk("image"); // some misfiled
  // also root-level video uploads if any
  const { data: root } = await supabase.storage.from(bucket).list("", { limit: 1000 });
  for (const item of root ?? []) {
    if (item.name === "video" || item.name === "image") continue;
    if (VIDEO_RE.test(item.name)) {
      out.push({ path: item.name, size: Number(item.metadata?.size) || 0 });
    }
  }
  return out;
}

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  ensureFfmpeg();

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const buckets = opts.bucket ? [opts.bucket] : BUCKETS;
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let examined = 0;

  console.log(opts.apply ? "MODE: apply (will overwrite)" : "MODE: dry-run (no writes)");

  for (const bucket of buckets) {
    console.log(`\n=== bucket: ${bucket} ===`);
    let files;
    try {
      files = await listAll(supabase, bucket);
    } catch (e) {
      console.error(`list failed: ${e.message || e}`);
      continue;
    }
    console.log(`found ${files.length} video-like objects`);

    for (const file of files) {
      if (examined >= opts.limit) break;
      examined++;

      if (!opts.force && file.size > MAX_BYTES) {
        console.log(`SKIP large (${file.size}): ${bucket}/${file.path}`);
        skipped++;
        continue;
      }

      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(file.path);
      if (dlErr || !blob) {
        console.error(`DOWNLOAD fail ${file.path}: ${dlErr?.message}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      if (!needsConvert(file.path, buf) && !opts.force) {
        console.log(`OK already web-safe: ${file.path}`);
        skipped++;
        continue;
      }

      console.log(`CONVERT ${opts.apply ? "" : "(dry) "}${bucket}/${file.path} (${buf.length} bytes)`);
      if (!opts.apply) {
        converted++;
        continue;
      }

      const dir = mkdtempSync(join(tmpdir(), "wsc-vid-"));
      const inPath = join(dir, "in.bin");
      const outPath = join(dir, "out.mp4");
      try {
        writeFileSync(inPath, buf);
        transcodeFile(inPath, outPath);
        const out = readFileSync(outPath);
        const { error: upErr } = await supabase.storage.from(bucket).upload(file.path, out, {
          contentType: "video/mp4",
          upsert: true,
          cacheControl: "3600",
        });
        if (upErr) throw upErr;
        console.log(`  → wrote ${out.length} bytes video/mp4`);
        converted++;
      } catch (e) {
        console.error(`  FAIL: ${e.message || e}`);
        failed++;
      } finally {
        try {
          unlinkSync(inPath);
        } catch {
          /* ignore */
        }
        try {
          unlinkSync(outPath);
        } catch {
          /* ignore */
        }
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  }

  console.log(`\nDone. examined=${examined} convert=${converted} skipped=${skipped} failed=${failed}`);
  if (!opts.apply) console.log("Re-run with --apply to write converted files.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
