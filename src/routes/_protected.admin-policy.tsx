// Admin-side policy page (rules for admins/supervisors).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPolicy } from "@/lib/features/policies.functions";
import { PolicyView } from "@/components/PolicyView";

export const Route = createFileRoute("/_protected/admin-policy")({
  head: () => ({ meta: [{ title: "ข้อกำหนดผู้ดูแลระบบ — WSC ProductionTrack" }] }),
  component: AdminPolicyPage,
});

function AdminPolicyPage() {
  const fetchPolicy = useServerFn(getPolicy);
  const [policy, setPolicy] = useState<{
    title: string;
    content: string;
    version: number;
    updated_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { policy } = await fetchPolicy({ data: { key: "admin_policy" } });
        if (alive) setPolicy(policy ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchPolicy]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Admin Policy
          </span>
        </div>
        <Link to="/manage-policies">
          <Button variant="outline" size="sm" className="gap-1">
            <Pencil className="h-4 w-4" /> แก้ไขเนื้อหา
          </Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
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
    </main>
  );
}
