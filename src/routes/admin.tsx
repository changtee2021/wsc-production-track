import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { verifyAdminPassword } from "@/lib/features/admin.functions";
import { lookupOfficeEmployee } from "@/lib/scan-trial.functions";
import { isAdminSession, saveAdminActor, setAdminToken } from "@/lib/auth/admin-session";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin")({
  validateSearch: zodValidator(
    z.object({ redirect: fallback(z.string(), "/dashboard").default("/dashboard") }),
  ),
  head: () => ({
    meta: [
      { title: "Admin Login — WSC ProductionTrack" },
      {
        name: "description",
        content: "Sign in to manage employees, steps, and view production reports.",
      },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(verifyAdminPassword);
  const lookup = useServerFn(lookupOfficeEmployee);
  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isAdminSession()) {
      navigate({ to: redirect });
    }
  }, [navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = empCode.trim();
    if (!code) {
      toast.error("สแกนบัตรหรือพิมพ์เลขพนักงานก่อน");
      return;
    }
    setLoading(true);
    try {
      const person = await lookup({ data: { code } });
      const res = await verify({ data: { password } });
      if (res.ok) {
        setAdminToken(res.token);
        saveAdminActor({
          id: person.id,
          name: person.name,
          empCode: person.empCode,
          avatarUrl: person.avatarUrl,
        });
        toast.success("Welcome, admin");
        navigate({ to: redirect });
      } else {
        toast.error(res.error || "Login failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <AppHeader mark="color">
        <Link to="/">
          <Button variant="secondary" size="sm">
            Home
          </Button>
        </Link>
      </AppHeader>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-lg"
          style={{ background: "var(--gradient-hero)" }}
        >
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Admin Login</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the admin password to continue</p>

        <form
          onSubmit={onSubmit}
          className="mt-6 w-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <Label htmlFor="emp" className="text-sm font-medium">
            รหัสพนักงาน
          </Label>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={async () => {
              const result = await acquireCameraStream("environment");
              if ("errorInfo" in result) {
                toast.error(
                  result.errorInfo.hint
                    ? `${result.errorInfo.message} — ${result.errorInfo.hint}`
                    : result.errorInfo.message,
                );
                return;
              }
              setScannerStream(result.stream);
            }}
            className="mt-2 h-12 w-full gap-2 text-base font-semibold"
          >
            <ScanLine className="h-5 w-5" /> สแกนบัตรพนักงาน
          </Button>
          <Input
            id="emp"
            value={empCode}
            onChange={(e) => setEmpCode(e.target.value)}
            className="mt-2 h-12 text-base"
            inputMode="numeric"
            autoFocus
            placeholder="หรือพิมพ์เลขพนักงาน"
            aria-label="รหัสพนักงาน"
          />
          <Label htmlFor="pw" className="mt-4 text-sm font-medium">
            Password
          </Label>
          <Input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12 text-base"
            required={!import.meta.env.DEV}
            placeholder={import.meta.env.DEV ? "Local dev: leave blank" : undefined}
          />
          <Button
            type="submit"
            disabled={loading}
            className="mt-4 h-12 w-full text-base font-semibold"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <QrScannerDialog
          open={scannerStream !== null}
          onOpenChange={(next) => {
            if (!next) setScannerStream(null);
          }}
          onScanned={(text) => {
            setScannerStream(null);
            setEmpCode(text.trim());
          }}
          initialStream={scannerStream}
        />
      </main>
    </div>
  );
}
