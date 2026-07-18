/**
 * Repair common broken MP4 layouts that Chrome/Edge refuse to play.
 * LINE / some phone apps write `mdat` with size=1 but omit the 64-bit largesize,
 * so the first media bytes are misread as the size → browser onError.
 */

function readU32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

function writeU32(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}

function readFourCC(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
}

export type Mp4Health = {
  isMp4: boolean;
  hasFtyp: boolean;
  hasMoov: boolean;
  hasMdat: boolean;
  /** mdat size==1 without a plausible 64-bit size (LINE / broken writers) */
  brokenMdatSize: boolean;
  /** HEVC tracks — often unplayable in Chrome/Edge on Windows */
  hasHevc: boolean;
  moovBeforeMdat: boolean;
};

/** Scan ISO-BMFF boxes (best-effort, top-level + light codec sniff). */
export function inspectMp4(bytes: Uint8Array): Mp4Health {
  const health: Mp4Health = {
    isMp4: false,
    hasFtyp: false,
    hasMoov: false,
    hasMdat: false,
    brokenMdatSize: false,
    hasHevc: false,
    moovBeforeMdat: true,
  };

  if (bytes.length < 12) return health;
  if (!(bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)) {
    return health;
  }
  health.isMp4 = true;
  health.hasFtyp = true;

  let moovAt = -1;
  let mdatAt = -1;
  let pos = 0;
  let guard = 0;

  while (pos + 8 <= bytes.length && guard++ < 10_000) {
    let size = readU32(bytes, pos);
    const type = readFourCC(bytes, pos + 4);
    let header = 8;

    if (size === 1) {
      if (pos + 16 > bytes.length) break;
      // 64-bit largesize
      const hi = readU32(bytes, pos + 8);
      const lo = readU32(bytes, pos + 12);
      const size64 = hi * 2 ** 32 + lo;
      header = 16;

      if (type === "mdat") {
        health.hasMdat = true;
        mdatAt = pos;
        // Valid 64-bit size must equal remaining file bytes exactly (box includes header)
        const expected = bytes.length - pos;
        if (size64 !== expected) {
          health.brokenMdatSize = true;
        }
      }
      if (size64 < 16) break;
      pos += size64;
      continue;
    }

    if (size === 0) {
      // Extends to EOF
      if (type === "mdat") {
        health.hasMdat = true;
        mdatAt = pos;
      }
      if (type === "moov") {
        health.hasMoov = true;
        moovAt = pos;
      }
      break;
    }

    if (size < 8 || pos + size > bytes.length + 8) {
      // Truncated / corrupt — stop walking
      if (type === "mdat") {
        health.hasMdat = true;
        mdatAt = pos;
        health.brokenMdatSize = true;
      }
      break;
    }

    if (type === "ftyp") health.hasFtyp = true;
    if (type === "moov") {
      health.hasMoov = true;
      moovAt = pos;
    }
    if (type === "mdat") {
      health.hasMdat = true;
      mdatAt = pos;
    }

    pos += size;
  }

  // Codec sniff in first ~256KB
  const sniffEnd = Math.min(bytes.length, 256 * 1024);
  const ascii = Array.from(bytes.subarray(0, sniffEnd), (c) =>
    c >= 32 && c <= 126 ? String.fromCharCode(c) : ".",
  ).join("");
  if (ascii.includes("hvc1") || ascii.includes("hev1") || ascii.includes("hevC")) {
    health.hasHevc = true;
  }

  if (moovAt >= 0 && mdatAt >= 0) {
    health.moovBeforeMdat = moovAt < mdatAt;
  }

  return health;
}

/**
 * If mdat has size=1 without a valid largesize, rewrite size to (fileLen - mdatOffset).
 * Returns a new File when repaired, otherwise the original.
 */
export async function repairMp4IfNeeded(file: File): Promise<{ file: File; repaired: boolean }> {
  const mime = file.type || "video/mp4";
  const looksMp4 =
    mime === "video/mp4" ||
    mime === "video/quicktime" ||
    mime === "video/x-m4v" ||
    /\.(mp4|mov|m4v)$/i.test(file.name);
  if (!looksMp4) return { file, repaired: false };

  const buf = new Uint8Array(await file.arrayBuffer());
  const health = inspectMp4(buf);
  if (!health.isMp4 || !health.brokenMdatSize) {
    return { file, repaired: false };
  }

  // Find top-level mdat with size===1
  let pos = 0;
  let guard = 0;
  let repaired = false;

  while (pos + 8 <= buf.length && guard++ < 10_000) {
    const size = readU32(buf, pos);
    const type = readFourCC(buf, pos + 4);

    if (type === "mdat" && size === 1) {
      const newSize = buf.length - pos;
      if (newSize >= 8 && newSize <= 0xffffffff) {
        writeU32(buf, pos, newSize);
        repaired = true;
      }
      break;
    }

    if (size === 1) {
      if (pos + 16 > buf.length) break;
      const hi = readU32(buf, pos + 8);
      const lo = readU32(buf, pos + 12);
      const size64 = hi * 2 ** 32 + lo;
      if (size64 < 16) break;
      pos += size64;
      continue;
    }
    if (size === 0) break;
    if (size < 8) break;
    pos += size;
  }

  if (!repaired) return { file, repaired: false };

  const out = new File([buf], file.name, { type: mime === "video/quicktime" ? "video/mp4" : mime, lastModified: file.lastModified });
  // Prefer .mp4 extension after repair for web playback hints
  if (/\.(mov|m4v)$/i.test(out.name)) {
    const renamed = out.name.replace(/\.(mov|m4v)$/i, ".mp4");
    return {
      file: new File([buf], renamed, { type: "video/mp4", lastModified: file.lastModified }),
      repaired: true,
    };
  }
  return { file: out, repaired: true };
}

/** True when the file likely needs remux/transcode for Chrome/Edge. */
export function needsWebSafeRemux(health: Mp4Health): boolean {
  if (!health.isMp4) return false;
  if (health.brokenMdatSize) return true;
  if (health.hasHevc) return true;
  if (!health.hasMoov || !health.hasMdat) return true;
  return false;
}

/** Probe whether <video> can decode this blob (quick metadata load). */
export function canHtmlVideoPlay(file: File): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const done = (ok: boolean) => {
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), 8_000);
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      // duration is enough — some containers report width=0 until first frame
      done(Number.isFinite(video.duration) && video.duration > 0);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(false);
    };
    video.src = url;
  });
}
