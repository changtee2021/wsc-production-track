import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { whGetAuthConfig, whIssueSession } from "@/lib/features/warehouse-settings.functions";
import { setWarehouseToken, isWarehouseSession } from "@/lib/auth/warehouse-session";
import { WarehouseEmployeeProvider } from "@/components/warehouse/warehouse-employee-context";
import { EmployeeDeptGate } from "@/components/EmployeeDeptGate";

export const Route = createFileRoute("/warehouse")({
  component: WarehousePageGate,
});

function WarehousePageGate() {
  return (
    <EmployeeDeptGate dept="warehouse">
      <WarehouseLayout />
    </EmployeeDeptGate>
  );
}

function WarehouseLayout() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [passcodeRequired, setPasscodeRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const issue = useServerFn(whIssueSession);
  const getAuthConfig = useServerFn(whGetAuthConfig);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHub = pathname === "/warehouse" || pathname === "/warehouse/";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isWarehouseSession()) {
        if (!cancelled) {
          setReady(true);
          setChecking(false);
        }
        return;
      }
      try {
        const cfg = await getAuthConfig();
        if (!cancelled) setPasscodeRequired(!!cfg.passcode_enabled);
        if (!cfg.passcode_enabled) {
          const res = await issue({ data: {} });
          setWarehouseToken(res.token);
          if (!cancelled) setReady(true);
        }
      } catch {
        /* show passcode form */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig, issue]);

  const unlock = async () => {
    setLoading(true);
    try {
      const res = await issue({ data: { passcode: passcode || undefined } });
      setWarehouseToken(res.token);
      setReady(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เข้าไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6">
        <Toaster richColors position="top-center" />
        <h1 className="text-xl font-bold">คลังสินค้า</h1>
        <p className="text-sm text-muted-foreground">
          {passcodeRequired ? "กรอกรหัสผ่านเพื่อเข้าใช้งาน" : "กำลังเข้าสู่ระบบ..."}
        </p>
        {passcodeRequired && (
          <>
            <Input
              type="password"
              placeholder="รหัสผ่าน"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              className="max-w-xs"
            />
            <Button onClick={unlock} disabled={loading} className="min-w-[140px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "เข้าใช้งาน"}
            </Button>
          </>
        )}
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            กลับหน้าแรก
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <WarehouseEmployeeProvider requireSelection={!isHub}>
      <Toaster richColors position="top-center" />
      <Outlet />
    </WarehouseEmployeeProvider>
  );
}
