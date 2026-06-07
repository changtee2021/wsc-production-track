// Public-facing terms of use page for scan-side employees.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPolicy } from "@/lib/features/policies.functions";
import { PolicyView } from "@/components/PolicyView";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "ข้อกำหนดการใช้งาน — WSC ProductionTrack" },
      {
        name: "description",
        content:
          "ข้อกำหนดและกฎระเบียบการใช้งานระบบ WSC ProductionTrack สำหรับพนักงานที่ใช้งานฝั่งสแกน",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const fetchPolicy = useServerFn(getPolicy);
  const [policy, setPolicy] = useState<{
    title: string;
    content: string;
    version: number;
    updated_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { policy } = await fetchPolicy({ data: { key: "terms" } });
        if (alive) setPolicy(policy ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchPolicy]);

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> กลับหน้าหลัก
            </Button>
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Terms of Use
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : policy ? (
          <>
            <h1 className="mb-1 text-3xl font-bold tracking-tight">{policy.title}</h1>
            <p className="mb-8 text-xs text-muted-foreground">
              เวอร์ชัน {policy.version} · ปรับปรุงเมื่อ{" "}
              {new Date(policy.updated_at).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <PolicyView content={policy.content} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อกำหนด</p>
        )}
      </section>
    </main>
  );
}
