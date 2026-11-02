// Admin tab: single share link (toggle / copy / open) + the live monitor board.
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MonitorBoard } from "@/components/monitor/MonitorBoard";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminGetMonitorShare, adminSetMonitorShare } from "@/lib/features/monitor.functions";

export function MonitorPanel() {
  const getShare = useServerFn(adminGetMonitorShare);
  const setShare = useServerFn(adminSetMonitorShare);
  const [share, setShareState] = useState<{ token: string; enabled: boolean } | null>(null);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      setShareState(await getShare({ data: { token } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลดลิงก์ไม่สำเร็จ");
    }
  }, [getShare]);

  useEffect(() => {
    void load();
  }, [load]);

  const url = share ? `${window.location.origin}/monitor/${share.token}` : "";

  const setEnabled = async (enabled: boolean) => {
    const token = getAdminToken();
    if (!token || !share) return;
    try {
      setShareState(await setShare({ data: { token, rotate: false, enabled } }));
      toast.success(enabled ? "เปิดลิงก์แล้ว" : "ปิดลิงก์แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="-mx-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={share?.enabled ?? false}
              disabled={!share}
              onCheckedChange={(v) => void setEnabled(v)}
            />
            เปิดใช้งาน
          </label>
          <Button
            variant="outline"
            className="h-11 gap-2"
            disabled={!share}
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("คัดลอกลิงก์แล้ว");
            }}
          >
            <Copy className="h-4 w-4" /> คัดลอก
          </Button>
          <Button
            variant="outline"
            className="h-11 gap-2"
            disabled={!share}
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            <ExternalLink className="h-4 w-4" /> เปิด
          </Button>
        </div>
      </div>
      {share?.enabled ? (
        <MonitorBoard share={share.token} />
      ) : (
        share && (
          <p className="p-10 text-center text-muted-foreground">
            ลิงก์ถูกปิดอยู่ เปิดใช้งานเพื่อดูบอร์ด
          </p>
        )
      )}
    </div>
  );
}
