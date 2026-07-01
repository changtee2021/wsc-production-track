/**
 * Browser smoke test for QC video compression (run while `npm run dev` is up on :8080).
 * Usage: npx playwright install chromium && node scripts/test-qc-video-compress.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8080";

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* optional */
  }
  return env;
}

async function runCompressionTest(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  return page.evaluate(async () => {
    const { compressVideo } = await import("/src/lib/utils/media-compress.ts");
    const { normalizeVideoFile, MAX_VIDEO_BYTES, VIDEO_AUTO_COMPRESS_ABOVE_BYTES } = await import(
      "/src/lib/utils/media-limits.ts"
    );

    async function recordSyntheticVideo(seconds) {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx || typeof canvas.captureStream !== "function") {
        throw new Error("canvas captureStream unavailable");
      }

      const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];
      const mime =
        candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ??
        null;
      if (!mime) throw new Error("MediaRecorder unsupported");

      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_500_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };

      await new Promise((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error("recorder failed"));
        recorder.start(200);
        const start = performance.now();
        const draw = () => {
          const t = (performance.now() - start) / 1000;
          if (t >= seconds) {
            recorder.stop();
            stream.getTracks().forEach((tr) => tr.stop());
            return;
          }
          ctx.fillStyle = `hsl(${(t * 60) % 360}, 75%, 42%)`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 72px sans-serif";
          ctx.fillText(`QC TEST ${t.toFixed(1)}s`, 60, 220);
          requestAnimationFrame(draw);
        };
        draw();
      });

      const type = mime.split(";")[0];
      const blob = new Blob(chunks, { type });
      return new File([blob], "synthetic-large.webm", { type });
    }

    let file = await recordSyntheticVideo(18);
    if (file.size <= VIDEO_AUTO_COMPRESS_ABOVE_BYTES) {
      file = await recordSyntheticVideo(28);
    }

    const emptyMov = new File([file], "iphone.mov", { type: "" });
    const normalized = normalizeVideoFile(emptyMov);

    const progress = [];
    const compressed = await compressVideo(file, {
      onProgress: (p) => progress.push(p),
    });

    return {
      ok:
        file.size > VIDEO_AUTO_COMPRESS_ABOVE_BYTES &&
        compressed.size <= MAX_VIDEO_BYTES &&
        progress.length > 0 &&
        normalized?.type === "video/quicktime",
      step: "compress",
      originalSize: file.size,
      compressedSize: compressed.size,
      compressedType: compressed.type,
      underLimit: compressed.size <= MAX_VIDEO_BYTES,
      triggeredCompress: file.size > VIDEO_AUTO_COMPRESS_ABOVE_BYTES,
      smaller: compressed.size < file.size,
      progressCount: progress.length,
      maxProgress: progress.length ? Math.max(...progress) : 0,
      normalizedMovMime: normalized?.type ?? null,
    };
  });
}

async function runQcLoginTest(page, password) {
  if (!password) return { ok: false, step: "login", error: "QC_PASSWORD missing in .env" };

  await page.goto(`${BASE}/qc`, { waitUntil: "networkidle" });
  await page.fill("#qcpw", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const loginGone = !(await page
    .locator("h1")
    .filter({ hasText: "เข้าสู่ระบบ QC" })
    .isVisible()
    .catch(() => false));
  const hasWorkbench =
    (await page.getByRole("button", { name: /สแกน/ }).count()) > 0 ||
    (await page.getByText("เลขงาน").count()) > 0;

  return { ok: loginGone && hasWorkbench, step: "login", loginGone, hasWorkbench };
}

async function runQcBundleTest(page) {
  await page.goto(`${BASE}/qc`, { waitUntil: "networkidle" });
  const entry = await page.locator('script[type="module"][src*="/qc"]').first().getAttribute("src");
  if (!entry) return { ok: false, step: "bundle", error: "qc chunk not found" };
  const url = entry.startsWith("http") ? entry : `${BASE}${entry}`;
  const body = await (await page.request.get(url)).text();
  const hasDirectUpload = body.includes("direct-video-upload") || body.includes("MediaUploadStatus");
  return { ok: hasDirectUpload, step: "bundle", hasDirectUpload, chunk: entry };
}

const env = loadEnv();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];

try {
  results.push(await runCompressionTest(page));
  results.push(await runQcBundleTest(page));
  results.push(await runQcLoginTest(page, env.QC_PASSWORD));
} catch (e) {
  results.push({
    ok: false,
    step: "fatal",
    error: e instanceof Error ? e.message : String(e),
  });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ passed: results.filter((r) => r.ok), failed, allOk: failed.length === 0 }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
