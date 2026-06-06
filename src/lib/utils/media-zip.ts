// ดาวน์โหลดสื่อทั้งหมดของ Job ID เป็นไฟล์ ZIP ผ่าน JSZip
import JSZip from "jszip";

export interface DownloadableMedia {
  url: string;          // signed URL ที่พร้อมโหลด
  filename: string;     // ชื่อไฟล์ใน zip
}

export async function downloadMediaAsZip(
  jobId: string,
  items: DownloadableMedia[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (items.length === 0) throw new Error("ไม่มีไฟล์สื่อให้ดาวน์โหลด");
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  let done = 0;
  for (const it of items) {
    try {
      const res = await fetch(it.url);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const blob = await res.blob();
      // กันชื่อซ้ำ
      const base = it.filename;
      const count = usedNames.get(base) ?? 0;
      usedNames.set(base, count + 1);
      const name = count === 0 ? base : base.replace(/(\.[^.]+)?$/, `_${count}$1`);
      zip.file(name, blob);
    } catch {
      // ข้ามไฟล์ที่โหลดไม่สำเร็จ
    }
    done += 1;
    onProgress?.(done, items.length);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  a.href = url;
  a.download = `${jobId}-media-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
