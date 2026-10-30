/**
 * Server-side video repair + compression (GitHub Actions daily cron + local CLI).
 * Staff upload unchanged; this job overwrites the same Storage path after convert.
 *
 * Pending = no video_processing row, OR status=failed AND attempts < 3.
 * Oldest files first so leftovers from a missed day are cleared before today's.
 *
 * Usage:
 *   node scripts/server-convert-videos.mjs
 *   node scripts/server-convert-videos.mjs --apply
 *   node scripts/server-convert-videos.mjs --apply --bucket=qc-media --limit=10 --budget-min=300
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SCHEMA (default wsc_production)
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BUCKETS = ["qc-media", "packing-media", "maintenance-media"];
const VIDEO_RE = /\.(mp4|mov|m4v|webm|qt)$/i;
const MAX_BYTES = 1024 * 1024 * 1024;
const MIN_AGE_MS = 3 * 60 * 1000;
const MAX_WIDTH = 1280;
const MAX_BITRATE = 5_000_000;
const MAX_ATTEMPTS = 3;

function loadEnv() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* .env optional in CI */
  }
}

function parseArgs(argv) {
  const o = { apply: false, bucket: null, limit: Infinity, budgetMin: 300, path: null };
  for (const a of argv) {
    if (a === "--apply") o.apply = true;
    else if (a.startsWith("--bucket=")) o.bucket = a.slice(9);
    else if (a.startsWith("--limit=")) o.limit = Number(a.slice(8)) || Infinity;
    else if (a.startsWith("--budget-min=")) o.budgetMin = Number(a.slice(13)) || 300;
    else if (a.startsWith("--path=")) o.path = a.slice(7);
  }
  return o;
}

function resolveBin(name) {
  const candidates = [process.env[`${name.toUpperCase()}_PATH`], name].filter(Boolean);
  // Windows winget ffmpeg path (same as other scripts in this repo)
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      join(
        process.env.LOCALAPPDATA,
        "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin",
        `${name}.exe`,
      ),
    );
  }
  for (const c of candidates) {
    if (c !== name && c !== process.env[`${name.toUpperCase()}_PATH`] && !existsSync(c)) continue;
    if (spawnSync(c, ["-version"], { encoding: "utf8" }).status === 0) return c;
  }
  throw new Error(`${name} not found on PATH`);
}

/* ---------- MP4 atom helpers (file-descriptor based) ---------- */

function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  const n = readSync(fd, b, 0, len, pos);
  return n === len ? b : b.subarray(0, n);
}

function walkAtoms(fd, fileSize) {
  const atoms = [];
  let pos = 0;
  while (pos + 8 <= fileSize && atoms.length < 64) {
    const h = readAt(fd, pos, 16);
    if (h.length < 8) break;
    let size = h.readUInt32BE(0);
    const type = h.toString("ascii", 4, 8);
    if (size === 1 && h.length >= 16) size = Number(h.readBigUInt64BE(8));
    if (size === 0) size = fileSize - pos;
    atoms.push({ type, pos, size });
    if (size < 8) break;
    pos += size;
  }
  return atoms;
}

function findTerminalMoov(fd, fileSize) {
  const len = Math.min(fileSize, 4 * 1024 * 1024);
  const start = fileSize - len;
  const tail = readAt(fd, start, len);
  for (let i = tail.length - 8; i >= 0; i--) {
    if (tail.toString("ascii", i + 4, i + 8) !== "moov") continue;
    const size = tail.readUInt32BE(i);
    if (size >= 8 && start + i + size === fileSize) return { offset: start + i, size };
  }
  return null;
}

/** Fix mdat length that swallows the trailing moov. Patches 4 bytes in place. */
function repairMdatInPlace(path) {
  const size = statSync(path).size;
  const fd = openSync(path, "r+");
  try {
    const head = readAt(fd, 0, 8);
    if (head.length < 8 || head.toString("ascii", 4, 8) !== "ftyp") return false;
    const moov = findTerminalMoov(fd, size);
    if (!moov) return false;
    const atoms = walkAtoms(fd, size);
    const mdat = atoms.find((a) => a.type === "mdat");
    if (!mdat || mdat.pos >= moov.offset) return false;
    const declared = readAt(fd, mdat.pos, 4).readUInt32BE(0);
    const correct = moov.offset - mdat.pos;
    if (correct < 8 || correct > 0xffffffff) return false;
    if (!(declared === 0 || declared === 1 || mdat.pos + declared > moov.offset)) return false;
    const b = Buffer.alloc(4);
    b.writeUInt32BE(correct >>> 0, 0);
    writeSync(fd, b, 0, 4, mdat.pos);
    return true;
  } finally {
    closeSync(fd);
  }
}

function moovIsAtEnd(path) {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  try {
    const atoms = walkAtoms(fd, size);
    const moov = atoms.find((a) => a.type === "moov");
    const mdat = atoms.find((a) => a.type === "mdat");
    return !!(moov && mdat && moov.pos > mdat.pos);
  } finally {
    closeSync(fd);
  }
}

/* ---------- ffmpeg ---------- */

function probe(ffprobe, path) {
  const r = spawnSync(
    ffprobe,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  if (r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout);
    const v = (j.streams || []).find((s) => s.codec_type === "video");
    if (!v) return null;
    const duration = Number(j.format?.duration) || 0;
    const bytes = Number(j.format?.size) || statSync(path).size;
    return {
      codec: v.codec_name,
      width: Number(v.width) || 0,
      pixFmt: v.pix_fmt,
      duration,
      bitrate: duration > 0 ? (bytes * 8) / duration : 0,
      container: String(j.format?.format_name || ""),
    };
  } catch {
    return null;
  }
}

function runFfmpeg(ffmpeg, args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || "ffmpeg failed").slice(-600));
}

function transcode(ffmpeg, input, output) {
  runFfmpeg(ffmpeg, [
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-maxrate",
    "3500k",
    "-bufsize",
    "7000k",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    `scale='min(${MAX_WIDTH},iw)':-2`,
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    output,
  ]);
}

function remuxFaststart(ffmpeg, input, output) {
  runFfmpeg(ffmpeg, [
    "-y",
    "-i",
    input,
    "-map",
    "0",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    output,
  ]);
}

/* ---------- storage / DB ---------- */

async function listVideos(supabase, bucket) {
  const out = [];
  async function walk(prefix) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id == null && !item.metadata) {
          await walk(path);
          continue;
        }
        const mime = String(item.metadata?.mimetype || "");
        if (VIDEO_RE.test(item.name) || mime.startsWith("video/")) {
          out.push({
            path,
            size: Number(item.metadata?.size) || 0,
            updatedAt: item.updated_at || item.created_at || null,
          });
        }
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  await walk("");
  return out;
}

async function downloadToFile(supabase, bucket, path, dest) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message || "sign failed");
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/** Map key = `${bucket}/${path}` → { status, attempts } */
async function loadProcessedMap(db) {
  const map = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("video_processing")
      .select("bucket, path, status, attempts")
      .range(from, from + 999);
    if (error) throw new Error(`video_processing: ${error.message} (apply the migration first)`);
    for (const r of data ?? []) {
      map.set(`${r.bucket}/${r.path}`, { status: r.status, attempts: r.attempts ?? 0 });
    }
    if ((data ?? []).length < 1000) break;
  }
  return map;
}

function isPending(entry) {
  if (!entry) return true;
  if (entry.status === "failed" && (entry.attempts ?? 0) < MAX_ATTEMPTS) return true;
  return false;
}

async function record(db, row) {
  const prev = row._prevAttempts ?? 0;
  const attempts = row.status === "failed" ? prev + 1 : Math.max(prev, 1);
  const { _prevAttempts, ...payload } = row;
  const { error } = await db.from("video_processing").upsert(
    {
      ...payload,
      attempts,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "bucket,path" },
  );
  if (error) console.error(`  record failed: ${error.message}`);
}

/* ---------- main ---------- */

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_SCHEMA || process.env.VITE_SUPABASE_SCHEMA || "wsc_production";
  if (!url || !key) throw new Error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const ffmpeg = resolveBin("ffmpeg");
  const ffprobe = resolveBin("ffprobe");
  const opt = { auth: { persistSession: false, autoRefreshToken: false } };
  const storageClient = createClient(url, key, opt);
  const db = createClient(url, key, { ...opt, db: { schema } });

  const deadline = Date.now() + opts.budgetMin * 60_000;
  const processed = await loadProcessedMap(db);
  console.log(
    `${opts.apply ? "MODE: apply" : "MODE: dry-run"} schema=${schema} tracked=${processed.size} budgetMin=${opts.budgetMin}`,
  );

  const stats = { converted: 0, remuxed: 0, ok: 0, failed: 0, skipped: 0 };
  let examined = 0;
  let remaining = 0;

  const buckets = opts.bucket ? [opts.bucket] : BUCKETS;
  /** @type {{ bucket: string, path: string, size: number, updatedAt: string | null, prevAttempts: number }[]} */
  const queue = [];

  for (const bucket of buckets) {
    let files;
    try {
      files = await listVideos(storageClient, bucket);
    } catch (e) {
      console.error(`list ${bucket} failed: ${e.message || e}`);
      continue;
    }
    console.log(`== ${bucket}: ${files.length} videos on Storage`);
    for (const f of files) {
      if (opts.path && f.path !== opts.path && !f.path.endsWith(opts.path)) continue;
      const keyId = `${bucket}/${f.path}`;
      const entry = processed.get(keyId);
      if (!isPending(entry)) continue;
      if (f.updatedAt && Date.now() - new Date(f.updatedAt).getTime() < MIN_AGE_MS) {
        stats.skipped++;
        continue;
      }
      queue.push({
        bucket,
        path: f.path,
        size: f.size,
        updatedAt: f.updatedAt,
        prevAttempts: entry?.attempts ?? 0,
      });
    }
  }

  // Oldest first — clear leftovers before today's uploads
  queue.sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
  remaining = Math.max(0, queue.length - (Number.isFinite(opts.limit) ? opts.limit : queue.length));
  console.log(`pending=${queue.length} (will process up to limit=${opts.limit})`);

  for (const item of queue) {
    if (examined >= opts.limit || Date.now() > deadline) {
      remaining = queue.length - examined;
      break;
    }
    const keyId = `${item.bucket}/${item.path}`;
    if (item.size > MAX_BYTES) {
      console.log(`SKIP too large ${keyId} (${item.size})`);
      if (opts.apply) {
        await record(db, {
          bucket: item.bucket,
          path: item.path,
          status: "skipped",
          size_before: item.size,
          error: "too large",
          _prevAttempts: item.prevAttempts,
        });
      }
      stats.skipped++;
      examined++;
      continue;
    }
    examined++;

    const dir = mkdtempSync(join(tmpdir(), "wsc-conv-"));
    const inPath = join(dir, "in.bin");
    const outPath = join(dir, "out.mp4");
    try {
      await downloadToFile(storageClient, item.bucket, item.path, inPath);
      const sizeBefore = statSync(inPath).size;
      const patched = repairMdatInPlace(inPath);
      const info = probe(ffprobe, inPath);

      let action;
      if (!info) action = "transcode";
      else if (
        info.codec !== "h264" ||
        info.pixFmt !== "yuv420p" ||
        info.width > MAX_WIDTH ||
        info.bitrate > MAX_BITRATE ||
        !/mp4|mov/.test(info.container) ||
        /\.(webm|mov|m4v|qt)$/i.test(item.path)
      ) {
        action = "transcode";
      } else if (patched || moovIsAtEnd(inPath)) {
        action = "remux";
      } else {
        action = "ok";
      }

      console.log(
        `${action.toUpperCase()} ${keyId} ${(sizeBefore / 1048576).toFixed(1)}MB` +
          (info ? ` ${info.codec} ${info.width}px ${(info.bitrate / 1e6).toFixed(1)}Mbps` : " (unprobeable)") +
          (patched ? " [header patched]" : ""),
      );

      if (!opts.apply) {
        if (action === "transcode") stats.converted++;
        else if (action === "remux") stats.remuxed++;
        else stats.ok++;
        continue;
      }

      if (action === "ok") {
        await record(db, {
          bucket: item.bucket,
          path: item.path,
          status: "ok",
          size_before: sizeBefore,
          size_after: sizeBefore,
          _prevAttempts: item.prevAttempts,
        });
        stats.ok++;
        continue;
      }

      if (action === "transcode") transcode(ffmpeg, inPath, outPath);
      else remuxFaststart(ffmpeg, inPath, outPath);

      const sizeAfter = statSync(outPath).size;
      if (
        action === "transcode" &&
        info &&
        info.codec === "h264" &&
        sizeAfter >= sizeBefore &&
        !patched
      ) {
        await record(db, {
          bucket: item.bucket,
          path: item.path,
          status: "ok",
          size_before: sizeBefore,
          size_after: sizeBefore,
          _prevAttempts: item.prevAttempts,
        });
        stats.ok++;
        continue;
      }
      if (!probe(ffprobe, outPath)) throw new Error("output failed verification");

      const { error: upErr } = await storageClient.storage
        .from(item.bucket)
        .upload(item.path, readFileSync(outPath), {
          contentType: "video/mp4",
          upsert: true,
          cacheControl: "3600",
        });
      if (upErr) throw upErr;

      await record(db, {
        bucket: item.bucket,
        path: item.path,
        status: action === "transcode" ? "converted" : "remuxed",
        size_before: sizeBefore,
        size_after: sizeAfter,
        _prevAttempts: item.prevAttempts,
      });
      console.log(`  → ${(sizeBefore / 1048576).toFixed(1)}MB → ${(sizeAfter / 1048576).toFixed(1)}MB`);
      if (action === "transcode") stats.converted++;
      else stats.remuxed++;
    } catch (e) {
      console.error(`  FAIL ${keyId}: ${e.message || e}`);
      if (opts.apply) {
        await record(db, {
          bucket: item.bucket,
          path: item.path,
          status: "failed",
          error: String(e.message || e).slice(0, 500),
          _prevAttempts: item.prevAttempts,
        });
      }
      stats.failed++;
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  }

  remaining = Math.max(remaining, queue.length - examined);
  console.log(`\nDone. examined=${examined} remaining≈${remaining} ${JSON.stringify(stats)}`);
  if (!opts.apply) console.log("Re-run with --apply to write.");
  if (stats.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
