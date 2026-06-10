// Server-only helpers สำหรับบันทึก SSR/route error ลง public.error_logs
// ไฟล์ *.server.ts ถูกกันออกจาก client bundle อยู่แล้ว
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RecordErrorInput = {
  level?: "error" | "warn";
  source?: "ssr" | "route" | "client" | "health";
  routePath?: string | null;
  message: string;
  stack?: string | null;
  statusCode?: number | null;
  userAgent?: string | null;
  requestUrl?: string | null;
};

const MAX_MSG = 4000;
const MAX_STACK = 16000;

function clamp(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length > max ? v.slice(0, max) : v;
}

/** บันทึก error ลงฐานข้อมูล แบบ kill-safe (ไม่ throw ออกไป) */
export async function recordError(input: RecordErrorInput): Promise<void> {
  try {
    const row = {
      level: input.level ?? "error",
      source: input.source ?? "ssr",
      route_path: clamp(input.routePath ?? null, 500),
      message: clamp(input.message, MAX_MSG) ?? "",
      stack: clamp(input.stack ?? null, MAX_STACK),
      status_code: input.statusCode ?? null,
      user_agent: clamp(input.userAgent ?? null, 500),
      request_url: clamp(input.requestUrl ?? null, 1000),
    };
    await supabaseAdmin.from("error_logs").insert(row as never);
  } catch {
    // เงียบไว้ — การบันทึก log ต้องไม่ทำให้ระบบล้มซ้ำ
  }
}
