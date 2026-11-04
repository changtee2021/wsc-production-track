// Badge entry for the QC and packing pages. The shared department password
// is not the door anymore: a real employee code from that department is.
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BadgeEmployee = {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
};

const buckets = new Map<string, number[]>();

function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

export function allowBadgeAttempt(limit = 30): boolean {
  const now = Date.now();
  const ip = clientIp();
  const recent = (buckets.get(ip) ?? []).filter((at) => at > now - 60_000);
  if (recent.length >= limit) {
    buckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  buckets.set(ip, recent);
  return true;
}

export async function findBadgeEmployee(
  table: "qc_employees" | "packing_employees",
  code: string,
): Promise<BadgeEmployee | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, name, emp_code, avatar_url")
    .eq("active", true)
    .eq("emp_code", trimmed)
    .limit(1);
  if (error) throw new Error("ตรวจเลขพนักงานไม่สำเร็จ");
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    emp_code: row.emp_code,
    avatar_url: row.avatar_url,
  };
}
