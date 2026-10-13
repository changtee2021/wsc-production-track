/**
 * Repair + H.264 backfill for Katie (แคทตี๊) QC videos in qc-media.
 *
 * - Fixes mdat that swallows trailing moov
 * - Converts HEVC / WebM / broken containers → H.264 AAC faststart
 *
 * Usage:
 *   node scripts/repair-katie-videos.mjs                 # dry-run (loads paths from DB)
 *   node scripts/repair-katie-videos.mjs --apply
 *   node scripts/repair-katie-videos.mjs --apply --limit=20
 *   node scripts/repair-katie-videos.mjs --paths-file=scripts/katie-video-paths.json --apply
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKET = "qc-media";
const MAX_BYTES = 500 * 1024 * 1024;

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  "ffmpeg",
  join(
    process.env.LOCALAPPDATA || "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe",
  ),
].filter(Boolean);

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

function parseArgs(argv) {
  const opts = {
    apply: false,
    limit: Infinity,
    pathsFile: null,
    force: false,
    /** Skip paths lexicographically before this (resume after crash) */
    after: null,
  };
  for (const a of argv) {
    if (a === "--apply") opts.apply = true;
    else if (a === "--force") opts.force = true;
    else if (a.startsWith("--limit=")) opts.limit = Number(a.slice("--limit=".length)) || Infinity;
    else if (a.startsWith("--paths-file=")) opts.pathsFile = a.slice("--paths-file=".length);
    else if (a.startsWith("--after=")) opts.after = a.slice("--after=".length);
  }
  return opts;
}

function resolveFfmpeg() {
  for (const c of FFMPEG_CANDIDATES) {
    if (c !== "ffmpeg" && !existsSync(c)) continue;
    const r = spawnSync(c, ["-version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  throw new Error("ffmpeg not found");
}

function readU32(b, o) {
  return b.readUInt32BE(o);
}

function findTerminalMoov(buf) {
  const scanFrom = Math.max(0, buf.length - 4 * 1024 * 1024);
  for (let i = buf.length - 8; i >= scanFrom; i--) {
    if (buf.toString("ascii", i + 4, i + 8) !== "moov") continue;
    const size = readU32(buf, i);
    if (size >= 8 && i + size === buf.length) return { offset: i, size };
  }
  return null;
}

function repairMdatSwallow(buf) {
  if (buf.length < 32) return { buf, repaired: false };
  if (buf.toString("ascii", 4, 8) !== "ftyp") return { buf, repaired: false };
  const moov = findTerminalMoov(buf);
  if (!moov) return { buf, repaired: false };

  let pos = 0;
  let mdatPos = -1;
  while (pos + 8 <= buf.length) {
    const size = readU32(buf, pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "mdat") {
      mdatPos = pos;
      break;
    }
    if (size < 8) break;
    pos += size;
  }
  if (mdatPos < 0 || mdatPos >= moov.offset) return { buf, repaired: false };

  const current = readU32(buf, mdatPos);
  const correct = moov.offset - mdatPos;
  if (correct < 8) return { buf, repaired: false };
  if (!(current === 0 || current === 1 || mdatPos + current > moov.offset)) {
    return { buf, repaired: false };
  }
  const out = Buffer.from(buf);
  out.writeUInt32BE(correct >>> 0, mdatPos);
  return { buf: out, repaired: true };
}

function asciiWindow(buf, start, end) {
  const from = Math.max(0, start);
  const to = Math.min(buf.length, end);
  let s = "";
  for (let i = from; i < to; i++) {
    const c = buf[i];
    s += c >= 32 && c <= 126 ? String.fromCharCode(c) : ".";
  }
  return s;
}

function hasHevc(buf) {
  const head = asciiWindow(buf, 0, 256 * 1024);
  const tail = asciiWindow(buf, buf.length - 512 * 1024, buf.length);
  const s = head + tail;
  return s.includes("hvc1") || s.includes("hev1") || s.includes("hevC");
}

function isWebm(buf) {
  return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

function needsWork(path, buf) {
  if (isWebm(buf) || /\.webm$/i.test(path)) return { convert: true, reason: "webm" };
  if (/\.(mov|m4v)$/i.test(path)) return { convert: true, reason: "apple-container" };
  const { repaired } = repairMdatSwallow(buf);
  if (repaired) return { convert: true, reason: "mdat-swallows-moov", needsPatch: true };
  // Probe whether moov is visible to a simple walk
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const moov = findTerminalMoov(buf);
    let pos = 0;
    let sawMoov = false;
    let mdatPos = -1;
    while (pos + 8 <= buf.length) {
      const size = readU32(buf, pos);
      const type = buf.toString("ascii", pos + 4, pos + 8);
      if (type === "moov") sawMoov = true;
      if (type === "mdat") mdatPos = pos;
      if (size < 8) break;
      if (pos + size > buf.length) break;
      pos += size;
      if (pos > buf.length) break;
    }
    if (!sawMoov && moov && mdatPos >= 0) {
      return { convert: true, reason: "mdat-swallows-moov", needsPatch: true };
    }
  }
  if (hasHevc(buf)) return { convert: true, reason: "hevc" };
  return { convert: false, reason: "ok" };
}

function transcode(ffmpeg, inputPath, outputPath) {
  const r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-i",
      inputPath,
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
      outputPath,
    ],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || "").slice(-1000) || "ffmpeg failed");
  }
}

async function loadKatiePaths(supabase) {
  const paths = new Set();
  let from = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("qc_reports")
      .select("media, qc_employees!inner(name)")
      .ilike("qc_employees.name", "%แคทตี%")
      .range(from, from + page - 1);
    if (error) throw new Error(`load paths: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const media = Array.isArray(row.media) ? row.media : [];
      for (const m of media) {
        if (m?.type === "video" && typeof m.url === "string" && m.url.startsWith("video/")) {
          paths.add(m.url);
        }
      }
    }
    if (data.length < page) break;
    from += page;
  }
  return [...paths].sort();
}

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv.slice(2));

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.VITE_SUPABASE_SCHEMA || process.env.SUPABASE_SCHEMA || "wsc_production";
  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const ffmpeg = resolveFfmpeg();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });

  let paths;
  if (opts.pathsFile) {
    paths = JSON.parse(readFileSync(opts.pathsFile, "utf8"));
  } else {
    console.log(`Loading Katie video paths from ${schema}.qc_reports ...`);
    paths = await loadKatiePaths(supabase);
  }
  if (!Array.isArray(paths) || !paths.length) {
    console.error("paths empty");
    process.exit(1);
  }

  console.log(opts.apply ? "MODE: apply" : "MODE: dry-run");
  console.log(`paths=${paths.length} ffmpeg=${ffmpeg}`);

  let examined = 0;
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let missing = 0;

  for (const path of paths) {
    if (opts.after && path <= opts.after) continue;
    if (examined >= opts.limit) break;
    examined++;

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
    if (dlErr || !blob) {
      console.error(`MISSING ${path}: ${dlErr?.message || "no data"}`);
      missing++;
      continue;
    }
    let buf = Buffer.from(await blob.arrayBuffer());
    if (!opts.force && buf.length > MAX_BYTES) {
      console.log(`SKIP large ${path} (${buf.length})`);
      skipped++;
      continue;
    }

    const verdict = needsWork(path, buf);
    if (!verdict.convert && !opts.force) {
      console.log(`OK ${path}`);
      skipped++;
      continue;
    }

    console.log(
      `${opts.apply ? "CONVERT" : "WOULD"} ${path} (${buf.length} bytes) reason=${verdict.reason}`,
    );
    if (!opts.apply) {
      converted++;
      continue;
    }

    const dir = mkdtempSync(join(tmpdir(), "katie-vid-"));
    const inPath = join(dir, "in.bin");
    const outPath = join(dir, "out.mp4");
    try {
      const patched = repairMdatSwallow(buf);
      buf = patched.buf;
      writeFileSync(inPath, buf);
      transcode(ffmpeg, inPath, outPath);
      const out = readFileSync(outPath);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, out, {
        contentType: "video/mp4",
        upsert: true,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      console.log(`  → wrote ${out.length} bytes`);
      converted++;
    } catch (e) {
      console.error(`  FAIL ${path}: ${e.message || e}`);
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

  console.log(
    `\nDone. examined=${examined} convert=${converted} skipped=${skipped} failed=${failed} missing=${missing}`,
  );
  if (!opts.apply) console.log("Re-run with --apply to write.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
