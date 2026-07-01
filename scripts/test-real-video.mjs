/**
 * Test a real video file through compressVideo.
 * Usage: node scripts/test-real-video.mjs "C:\path\to\file.mp4"
 */
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8080";
const videoPath = process.argv[2];

if (!videoPath || !existsSync(videoPath)) {
  console.error("Usage: node scripts/test-real-video.mjs <path-to-video>");
  process.exit(1);
}

const videoBytes = readFileSync(videoPath);
const videoBase64 = videoBytes.toString("base64");
const videoName = videoPath.split(/[\\/]/).pop() ?? "test.mp4";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(600_000);

try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  console.log("Running compression test (may take several minutes)...");
  const compressResult = await page.evaluate(
    async ({ b64, name }) => {
      const { compressVideo } = await import("/src/lib/utils/media-compress.ts");
      const { normalizeVideoFile, MAX_VIDEO_BYTES, VIDEO_AUTO_COMPRESS_ABOVE_BYTES } = await import(
        "/src/lib/utils/media-limits.ts"
      );

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const emptyType = new File([bytes], name, { type: "" });
      const normalized = normalizeVideoFile(emptyType);
      if (!normalized) return { ok: false, step: "mime", error: "unsupported mime" };

      // Probe duration
      const probeUrl = URL.createObjectURL(normalized);
      const probe = document.createElement("video");
      probe.src = probeUrl;
      await new Promise((res, rej) => {
        probe.onloadedmetadata = () => res(null);
        probe.onerror = () => rej(new Error("cannot decode video"));
      });
      const durationSec = probe.duration;
      URL.revokeObjectURL(probeUrl);

      const progress = [];
      const t0 = performance.now();
      let compressed;
      try {
        compressed = await compressVideo(normalized, {
          onProgress: (p) => progress.push(p),
        });
      } catch (e) {
        return {
          ok: false,
          step: "compress",
          error: e instanceof Error ? e.message : String(e),
          originalSize: normalized.size,
          durationSec,
          progressCount: progress.length,
          elapsedSec: Math.round((performance.now() - t0) / 1000),
        };
      }

      return {
        ok: compressed.size <= MAX_VIDEO_BYTES,
        step: "compress",
        originalSize: normalized.size,
        originalType: normalized.type,
        compressedSize: compressed.size,
        compressedType: compressed.type,
        durationSec,
        underLimit: compressed.size <= MAX_VIDEO_BYTES,
        triggeredCompress: normalized.size > VIDEO_AUTO_COMPRESS_ABOVE_BYTES,
        smaller: compressed.size < normalized.size,
        progressCount: progress.length,
        maxProgress: progress.length ? Math.max(...progress) : 0,
        elapsedSec: Math.round((performance.now() - t0) / 1000),
        mediaRecorder: typeof MediaRecorder !== "undefined",
        recorderMime: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(
          (m) => MediaRecorder.isTypeSupported(m),
        ) ?? null,
      };
    },
    { b64: videoBase64, name: videoName },
  );

  console.log(
    JSON.stringify(
      {
        file: videoName,
        fileSizeMB: +(videoBytes.length / (1024 * 1024)).toFixed(2),
        result: compressResult,
      },
      null,
      2,
    ),
  );
  process.exit(compressResult.ok ? 0 : 1);
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
