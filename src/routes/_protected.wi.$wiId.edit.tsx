import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { wiGet } from "@/lib/features/wi.functions";
import { WiEditor } from "@/components/wi/WiEditor";

export const Route = createFileRoute("/_protected/wi/$wiId/edit")({
  component: WiEditPage,
});

function WiEditPage() {
  const { wiId } = Route.useParams();
  const getFn = useServerFn(wiGet);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof wiGet>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await getFn({ data: { token: requireToken(), id: wiId } }));
    } catch (err) {
      showError(err);
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, [getFn, wiId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !detail) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" className="h-10 gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> ลองใหม่
          </Button>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[340px_1fr]">
        <Skeleton className="h-[480px] rounded-xl" />
        <Skeleton className="h-[480px] rounded-xl" />
      </main>
    );
  }

  return <WiEditor detail={detail} onReload={load} />;
}
