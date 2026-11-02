// Client-side helpers for the WI admin pages.
import { useEffect, useState } from "react";

const ACTOR_KEY = "wsc:wi-actor";
const ACTOR_EVENT = "wsc:wi-actor";
/** Fired when an action needs the actor name, so the layout can open its name prompt. */
export const ACTOR_NEEDED_EVENT = "wsc:wi-actor-needed";

/** WI accent (vermilion) — used only inside WI pages, app primary stays navy. */
export const WI_ACCENT_BTN =
  "bg-[#E32D24] text-white hover:bg-[#c8261e] focus-visible:ring-[#E32D24]/40";
export const WI_ACCENT_TEXT = "text-[#E32D24]";

// The admin login is shared, so each person types their name once per
// browser; it is stamped onto every WI action for the audit trail.
export function getWiActor(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTOR_KEY) ?? "";
}

export function setWiActor(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTOR_KEY, name.trim());
  window.dispatchEvent(new Event(ACTOR_EVENT));
}

export function useWiActor(): [string, (name: string) => void] {
  const [actor, setActor] = useState("");
  useEffect(() => {
    setActor(getWiActor());
    const onChange = () => setActor(getWiActor());
    window.addEventListener(ACTOR_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ACTOR_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return [actor, setWiActor];
}

/** Read the actor name or throw a user-facing error. */
export function requireWiActor(): string {
  const a = getWiActor().trim();
  if (!a) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(ACTOR_NEEDED_EVENT));
    throw new Error("ใส่ชื่อผู้ทำรายการก่อน (ปุ่มชื่อมุมขวาบน)");
  }
  return a;
}

export const WI_IMAGE_EXT = ["jpg", "jpeg", "png", "webp"] as const;
export const WI_VIDEO_EXT = ["mp4", "webm", "mov"] as const;
type WiExt = (typeof WI_IMAGE_EXT)[number] | (typeof WI_VIDEO_EXT)[number];

const EXT_BY_MIME: Record<string, WiExt> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function wiFileExt(file: File): WiExt | null {
  const byMime = EXT_BY_MIME[file.type];
  if (byMime) return byMime;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return ([...WI_IMAGE_EXT, ...WI_VIDEO_EXT] as readonly string[]).includes(ext)
    ? (ext as WiExt)
    : null;
}

type CreateUploadUrl = (args: {
  data: { token: string; wi_id: string; ext: WiExt; sizeBytes: number };
}) => Promise<{ path: string; signedUrl: string; contentType: string; kind: "image" | "video" }>;

/**
 * Upload one file to the private `wi-media` bucket through a server-signed
 * URL. Uses XHR (not fetch) so the editor can show real upload progress.
 */
export async function uploadWiFile(opts: {
  file: File;
  wiId: string;
  token: string;
  createUrl: CreateUploadUrl;
  onProgress?: (pct: number) => void;
}): Promise<{ path: string; kind: "image" | "video" }> {
  const ext = wiFileExt(opts.file);
  if (!ext) throw new Error("รองรับเฉพาะรูป JPG/PNG/WEBP และวิดีโอ MP4/WEBM/MOV");
  const signed = await opts.createUrl({
    data: { token: opts.token, wi_id: opts.wiId, ext, sizeBytes: opts.file.size },
  });
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append(
    "",
    opts.file.type === signed.contentType
      ? opts.file
      : new File([opts.file], opts.file.name, { type: signed.contentType }),
  );
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`อัปโหลดไม่สำเร็จ (${xhr.status})`));
    xhr.onerror = () => reject(new Error("อัปโหลดไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ต"));
    xhr.send(body);
  });
  return { path: signed.path, kind: signed.kind };
}

export function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const WI_ACTIVITY_LABEL: Record<string, string> = {
  created: "สร้าง WI",
  updated: "แก้ไขร่าง",
  duplicated: "คัดลอก WI",
  submitted: "ส่งตรวจ",
  published: "อนุมัติ & เผยแพร่",
  changes_requested: "ส่งกลับแก้ไข",
  archived: "เก็บถาวร",
  restored: "กู้คืน",
  linked: "ผูกกับงานผลิต",
  unlinked: "ยกเลิกการผูกงานผลิต",
};
