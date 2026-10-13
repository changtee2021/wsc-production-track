/**
 * Repair common broken MP4 layouts that Chrome/Edge refuse to play.
 *
 * Cases handled:
 * 1) LINE / some apps: `mdat` size=1 without a valid 64-bit largesize
 * 2) Some phone cameras: `mdat` size claims EOF and swallows a trailing `moov`
 *    (players report "moov atom not found" even though moov bytes exist)
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

function asciiIncludes(bytes: Uint8Array, start: number, end: number, needle: string): boolean {
  const from = Math.max(0, start);
  const to = Math.min(bytes.length, end);
  if (to <= from) return false;
  let s = "";
  for (let i = from; i < to; i++) {
    const c = bytes[i]!;
    s += c >= 32 && c <= 126 ? String.fromCharCode(c) : ".";
  }
  return s.includes(needle);
}

/** Find a top-level `moov` box that ends exactly at EOF (common phone layout). */
export function findTerminalMoov(bytes: Uint8Array): { offset: number; size: number } | null {
  const scanFrom = Math.max(0, bytes.length - 4 * 1024 * 1024);
  for (let i = bytes.length - 8; i >= scanFrom; i--) {
    if (readFourCC(bytes, i + 4) !== "moov") continue;
    const size = readU32(bytes, i);
    if (size >= 8 && i + size === bytes.length) {
      return { offset: i, size };
    }
  }
  return null;
}

function findTopLevelMdat(bytes: Uint8Array): { offset: number; size: number } | null {
  let pos = 0;
  let guard = 0;
  while (pos + 8 <= bytes.length && guard++ < 10_000) {
    const size = readU32(bytes, pos);
    const type = readFourCC(bytes, pos + 4);
    if (type === "mdat") {
      if (size === 1) {
        if (pos + 16 > bytes.length) return { offset: pos, size: 1 };
        const hi = readU32(bytes, pos + 8);
        const lo = readU32(bytes, pos + 12);
        return { offset: pos, size: hi * 2 ** 32 + lo };
      }
      if (size === 0) return { offset: pos, size: bytes.length - pos };
      return { offset: pos, size };
    }
    if (size === 1) {
      if (pos + 16 > bytes.length) break;
      const hi = readU32(bytes, pos + 8);
      const lo = readU32(bytes, pos + 12);
      const size64 = hi * 2 ** 32 + lo;
      if (size64 < 16) break;
      pos += size64;
      continue;
    }
    if (size === 0 || size < 8) break;
    pos += size;
  }
  return null;
}

export type Mp4Health = {
  isMp4: boolean;
  hasFtyp: boolean;
  hasMoov: boolean;
  hasMdat: boolean;
  /** mdat size==1 without a plausible 64-bit size (LINE / broken writers) */
  brokenMdatSize: boolean;
  /** mdat size extends over a trailing moov — ffmpeg/Chrome often fail */
  mdatSwallowsMoov: boolean;
  /** HEVC tracks — often unplayable in Chrome/Edge on Windows */
  hasHevc: boolean;
  moovBeforeMdat: boolean;
};

function sniffHevc(bytes: Uint8Array, moovAt: number): boolean {
  if (asciiIncludes(bytes, 0, Math.min(bytes.length, 256 * 1024), "hvc1")) return true;
  if (asciiIncludes(bytes, 0, Math.min(bytes.length, 256 * 1024), "hev1")) return true;
  if (asciiIncludes(bytes, 0, Math.min(bytes.length, 256 * 1024), "hevC")) return true;
  // Codec tags usually live in moov near EOF for phone recordings
  if (moovAt >= 0) {
    if (asciiIncludes(bytes, moovAt, bytes.length, "hvc1")) return true;
    if (asciiIncludes(bytes, moovAt, bytes.length, "hev1")) return true;
    if (asciiIncludes(bytes, moovAt, bytes.length, "hevC")) return true;
  } else {
    const tailFrom = Math.max(0, bytes.length - 512 * 1024);
    if (asciiIncludes(bytes, tailFrom, bytes.length, "hvc1")) return true;
    if (asciiIncludes(bytes, tailFrom, bytes.length, "hev1")) return true;
    if (asciiIncludes(bytes, tailFrom, bytes.length, "hevC")) return true;
  }
  return false;
}

/** Scan ISO-BMFF boxes (best-effort, top-level + light codec sniff). */
export function inspectMp4(bytes: Uint8Array): Mp4Health {
  const health: Mp4Health = {
    isMp4: false,
    hasFtyp: false,
    hasMoov: false,
    hasMdat: false,
    brokenMdatSize: false,
    mdatSwallowsMoov: false,
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
    const size = readU32(bytes, pos);
    const type = readFourCC(bytes, pos + 4);

    if (size === 1) {
      if (pos + 16 > bytes.length) break;
      const hi = readU32(bytes, pos + 8);
      const lo = readU32(bytes, pos + 12);
      const size64 = hi * 2 ** 32 + lo;

      if (type === "mdat") {
        health.hasMdat = true;
        mdatAt = pos;
        const expected = bytes.length - pos;
        if (size64 !== expected) {
          health.brokenMdatSize = true;
        }
      }
      if (type === "moov") {
        health.hasMoov = true;
        moovAt = pos;
      }
      if (size64 < 16) break;
      pos += size64;
      continue;
    }

    if (size === 0) {
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

  // Phone cameras sometimes write mdat.size = (EOF - mdatOffset), burying moov inside mdat.
  if (!health.hasMoov) {
    const terminal = findTerminalMoov(bytes);
    if (terminal) {
      health.hasMoov = true;
      moovAt = terminal.offset;
      if (mdatAt >= 0) {
        const declared = readU32(bytes, mdatAt);
        const mdatEnd = declared === 0 || declared === 1 ? bytes.length : mdatAt + declared;
        if (mdatEnd > terminal.offset) {
          health.mdatSwallowsMoov = true;
          health.brokenMdatSize = true;
        }
      }
    }
  } else if (mdatAt >= 0 && moovAt > mdatAt) {
    const declared = readU32(bytes, mdatAt);
    if (declared > 8 && mdatAt + declared > moovAt) {
      health.mdatSwallowsMoov = true;
      health.brokenMdatSize = true;
    }
  }

  health.hasHevc = sniffHevc(bytes, moovAt);

  if (moovAt >= 0 && mdatAt >= 0) {
    health.moovBeforeMdat = moovAt < mdatAt;
  }

  return health;
}

/** Mutating repair on a full buffer. Copies only when a fix is applied. */
export function repairMp4Bytes(input: Uint8Array): { bytes: Uint8Array; repaired: boolean } {
  if (input.length < 12) return { bytes: input, repaired: false };
  if (!(input[4] === 0x66 && input[5] === 0x74 && input[6] === 0x79 && input[7] === 0x70)) {
    return { bytes: input, repaired: false };
  }

  let mdatSize1At = -1;
  {
    let pos = 0;
    let guard = 0;
    while (pos + 8 <= input.length && guard++ < 10_000) {
      const size = readU32(input, pos);
      const type = readFourCC(input, pos + 4);
      if (type === "mdat" && size === 1) {
        mdatSize1At = pos;
        break;
      }
      if (size === 1) {
        if (pos + 16 > input.length) break;
        const hi = readU32(input, pos + 8);
        const lo = readU32(input, pos + 12);
        const size64 = hi * 2 ** 32 + lo;
        if (size64 < 16) break;
        pos += size64;
        continue;
      }
      if (size === 0 || size < 8) break;
      pos += size;
    }
  }

  const moov = findTerminalMoov(input);
  const mdat = findTopLevelMdat(input);
  let swallowFixAt = -1;
  let swallowCorrect = 0;
  if (moov && mdat && mdat.offset < moov.offset) {
    const correctSize = moov.offset - mdat.offset;
    const current = readU32(input, mdat.offset);
    if (
      correctSize >= 8 &&
      correctSize <= 0xffffffff &&
      (current === 0 || current === 1 || mdat.offset + current > moov.offset)
    ) {
      swallowFixAt = mdat.offset;
      swallowCorrect = correctSize;
    }
  }

  if (mdatSize1At < 0 && swallowFixAt < 0) {
    return { bytes: input, repaired: false };
  }

  const buf = input.slice();
  if (mdatSize1At >= 0) {
    const newSize = buf.length - mdatSize1At;
    if (newSize >= 8 && newSize <= 0xffffffff) writeU32(buf, mdatSize1At, newSize);
  }
  if (swallowFixAt >= 0) writeU32(buf, swallowFixAt, swallowCorrect);
  return { bytes: buf, repaired: true };
}

const LARGE_REPAIR_BYTES = 12 * 1024 * 1024;

function u32Bytes(v: number): Uint8Array {
  const b = new Uint8Array(4);
  writeU32(b, 0, v >>> 0);
  return b;
}

/**
 * Low-memory repair for phone uploads: only rewrite the 4-byte mdat size field via Blob
 * slices — avoids loading a second full copy of 30–50MB videos into RAM (Safari "Load failed").
 */
async function repairMp4FileStreaming(file: File): Promise<{ file: File; repaired: boolean }> {
  const headLen = Math.min(file.size, 64);
  const head = new Uint8Array(await file.slice(0, headLen).arrayBuffer());
  if (head.length < 12 || readFourCC(head, 4) !== "ftyp") {
    return { file, repaired: false };
  }

  const ftypSize = readU32(head, 0);
  if (ftypSize < 8 || ftypSize + 8 > head.length) return { file, repaired: false };
  if (readFourCC(head, ftypSize + 4) !== "mdat") return { file, repaired: false };

  const mdatOffset = ftypSize;
  const declared = readU32(head, mdatOffset);

  // Case: mdat size === 1 (LINE / broken writers)
  if (declared === 1) {
    const corrected = file.size - mdatOffset;
    if (corrected < 8 || corrected > 0xffffffff) return { file, repaired: false };
    return {
      file: new File(
        [file.slice(0, mdatOffset), u32Bytes(corrected), file.slice(mdatOffset + 4)],
        file.name.replace(/\.(mov|m4v)$/i, ".mp4"),
        {
          type: file.type === "video/quicktime" ? "video/mp4" : file.type || "video/mp4",
          lastModified: file.lastModified,
        },
      ),
      repaired: true,
    };
  }

  // Case: mdat claims EOF and buries trailing moov
  if (declared !== 0 && mdatOffset + declared !== file.size) {
    return { file, repaired: false };
  }

  const tailLen = Math.min(file.size, 2 * 1024 * 1024);
  const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
  for (let i = tail.length - 8; i >= 0; i--) {
    if (readFourCC(tail, i + 4) !== "moov") continue;
    const sz = readU32(tail, i);
    const absMoov = file.size - tailLen + i;
    if (sz < 8 || absMoov + sz !== file.size) continue;
    if (!(mdatOffset + declared > absMoov || declared === 0)) continue;
    const corrected = absMoov - mdatOffset;
    if (corrected < 8 || corrected > 0xffffffff) return { file, repaired: false };
    return {
      file: new File(
        [file.slice(0, mdatOffset), u32Bytes(corrected), file.slice(mdatOffset + 4)],
        file.name.replace(/\.(mov|m4v)$/i, ".mp4"),
        {
          type: file.type === "video/quicktime" ? "video/mp4" : file.type || "video/mp4",
          lastModified: file.lastModified,
        },
      ),
      repaired: true,
    };
  }

  return { file, repaired: false };
}

/**
 * Repair broken MP4 box layouts. Returns a new File when repaired, otherwise the original.
 * Large files use streaming Blob surgery to avoid OOM / Safari "Load failed".
 */
export async function repairMp4IfNeeded(file: File): Promise<{ file: File; repaired: boolean }> {
  const mime = file.type || "video/mp4";
  const looksMp4 =
    mime === "video/mp4" ||
    mime === "video/quicktime" ||
    mime === "video/x-m4v" ||
    /\.(mp4|mov|m4v)$/i.test(file.name);
  if (!looksMp4) return { file, repaired: false };

  try {
    if (file.size > LARGE_REPAIR_BYTES) {
      return await repairMp4FileStreaming(file);
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const { bytes, repaired } = repairMp4Bytes(buf);
    if (!repaired) return { file, repaired: false };

    const outType = mime === "video/quicktime" ? "video/mp4" : mime;
    let name = file.name;
    if (/\.(mov|m4v)$/i.test(name)) {
      name = name.replace(/\.(mov|m4v)$/i, ".mp4");
    }
    return {
      file: new File([bytes], name, {
        type: outType === "video/quicktime" ? "video/mp4" : outType,
        lastModified: file.lastModified,
      }),
      repaired: true,
    };
  } catch (e) {
    // Don't block upload if repair itself OOMs — upload original.
    console.warn("[mp4-repair] skipped", e);
    return { file, repaired: false };
  }
}

/** True when the file likely needs remux/transcode for Chrome/Edge. */
export function needsWebSafeRemux(health: Mp4Health): boolean {
  if (!health.isMp4) return false;
  if (health.brokenMdatSize || health.mdatSwallowsMoov) return true;
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
      done(Number.isFinite(video.duration) && video.duration > 0);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(false);
    };
    video.src = url;
  });
}
