/**
 * Test compress + Supabase signed upload for a real video.
 */
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8080";
const videoPath = process.argv[2] ?? "C:\\Users\\Admin\\Downloads\\804566250.855746.mp4";

if (!existsSync(videoPath)) {
  console.error("Video not found:", videoPath);
  process.exit(1);
}

function loadEnv() {
  const env = {};
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const videoBase64 = readFileSync(videoPath).toString("base64");
const videoName = videoPath.split(/[\\/]/).pop();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(600_000);

try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const result = await page.evaluate(
    async ({ b64, name, qcPassword }) => {
      const { compressVideo } = await import("/src/lib/utils/media-compress.ts");
      const { normalizeVideoFile } = await import("/src/lib/utils/media-limits.ts");
      const { uploadVideoViaSignedUrl } = await import("/src/lib/utils/direct-video-upload.ts");

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const normalized = normalizeVideoFile(new File([bytes], name, { type: "" }));
      if (!normalized) return { ok: false, error: "bad mime" };

      const compressed = await compressVideo(normalized, { onProgress: () => {} });

      // Login QC via server function
      const loginRes = await fetch("/api/qc/verifyQcPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { password: qcPassword } }),
      }).catch(() => null);

      // TanStack Start server fn path varies — try dynamic import instead
      let token = null;
      try {
        const { verifyQcPassword } = await import("/src/lib/features/qc.functions.ts");
        // server fn not callable from browser directly
      } catch {}

      return {
        ok: false,
        error: "use-ui-upload",
        compressedSize: compressed.size,
        compressedType: compressed.type,
      };
    },
    { b64: videoBase64, name: videoName, qcPassword: env.QC_PASSWORD },
  );

  // UI upload path: login then set file
  await page.goto(`${BASE}/qc`, { waitUntil: "networkidle" });
  await page.fill("#qcpw", env.QC_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  const requests = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/qcCreateVideoUploadUrl|storage\/v1\/object|uploadToSignedUrl/i.test(u)) {
      requests.push(`${r.method()} ${u.slice(0, 100)}`);
    }
  });

  const responses = [];
  page.on("response", async (r) => {
    const u = r.url();
    if (/qcCreateVideoUploadUrl|storage\/v1\/object/i.test(u)) {
      responses.push({ url: u.slice(0, 80), status: r.status() });
    }
  });

  const inputs = page.locator('input[type="file"][accept="video/*"]');
  const n = await inputs.count();

  let uploadResult = { inputCount: n, requests: [], responses: [], toasts: [] };

  if (n > 0) {
    await inputs.first().setInputFiles(videoPath);
    // wait for compress (~61s) + upload
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(2000);
      const compressing = await page.getByText(/กำลังบีบอัดวิดีโอ/).count();
      const uploading = await page.getByText(/กำลังอัปโหลด/).count();
      const toasts = await page.locator("[data-sonner-toast]").allTextContents();
      if (compressing === 0 && uploading === 0 && (requests.length > 0 || toasts.length > 0)) break;
      if (i === 89) uploadResult.timeout = true;
    }
    uploadResult.toasts = await page.locator("[data-sonner-toast]").allTextContents();
    uploadResult.videoCount = await page.locator("video").count();
  }

  uploadResult.requests = requests;
  uploadResult.responses = responses;

  console.log(JSON.stringify({ compress: result, upload: uploadResult }, null, 2));
} finally {
  await browser.close();
}
