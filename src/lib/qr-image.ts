import { BrowserMultiFormatReader } from "@zxing/browser";

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<DetectedBarcode[]>;
};

function nativeDetector(): BarcodeDetectorLike | null {
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function decodeElement(
  reader: BrowserMultiFormatReader,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const img = new Image();
  img.src = canvas.toDataURL("image/jpeg", 0.92);
  await img.decode();
  try {
    const result = await reader.decodeFromImageElement(img);
    const text = result.getText().trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Read every QR in one photo. No model is involved — the code is decoded from the squares. */
export async function decodeQrCodes(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  const found = new Set<string>();
  try {
    const detector = nativeDetector();
    if (detector) {
      const codes = await detector.detect(bitmap);
      for (const code of codes) {
        const value = code.rawValue?.trim();
        if (value) found.add(value);
      }
      if (found.size > 0) return [...found];
    }

    const reader = new BrowserMultiFormatReader();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const orientations = [0, 180];
    for (const turn of orientations) {
      const width = bitmap.width;
      const height = bitmap.height;
      canvas.width = width;
      canvas.height = height;
      ctx.save();
      if (turn === 180) {
        ctx.translate(width, height);
        ctx.rotate(Math.PI);
      }
      ctx.drawImage(bitmap, 0, 0);
      ctx.restore();
      const whole = await decodeElement(reader, canvas);
      if (whole) found.add(whole);

      const bandH = Math.ceil(height / 4);
      const step = Math.max(1, Math.floor(bandH * 0.5));
      for (let y = 0; y < height; y += step) {
        const h = Math.min(bandH, height - y);
        if (h < 48) break;
        canvas.width = width;
        canvas.height = h;
        ctx.save();
        if (turn === 180) {
          ctx.translate(width, h);
          ctx.rotate(Math.PI);
          ctx.drawImage(bitmap, 0, height - y - h, width, h, 0, 0, width, h);
        } else {
          ctx.drawImage(bitmap, 0, y, width, h, 0, 0, width, h);
        }
        ctx.restore();
        const text = await decodeElement(reader, canvas);
        if (text) found.add(text);
      }
    }
    return [...found];
  } finally {
    bitmap.close();
  }
}
