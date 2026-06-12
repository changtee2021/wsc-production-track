import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { verifyAdminPassword } from "@/lib/features/admin.functions";
import { isAdminSession, setAdminToken } from "@/lib/auth/admin-session";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdminSession()) {
      navigate({ to: redirect });
    }
  }, [navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await verify({ data: { password } });
      if (res.ok) {
        setAdminToken(res.token);
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
      <AppHeader>
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
          <Label htmlFor="pw" className="text-sm font-medium">
            Password
          </Label>
          <Input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12 text-base"
            autoFocus
            required
          />
          <Button
            type="submit"
            disabled={loading}
            className="mt-4 h-12 w-full text-base font-semibold"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </main>
    </div>
  );
}
