import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { wiGetVersion, wiVersionsFeed } from "@/lib/features/wi.functions";
import { versionLabel } from "@/lib/wi/wi-schema";
import { formatThaiDateTime } from "@/lib/wi/wi-client";
import { WiVersionTag } from "@/components/wi/WiStatusBadge";
import { WiViewer } from "@/components/wi/WiViewer";

export const Route = createFileRoute("/_protected/wi/versions")({
  component: WiVersionsPage,
});

const PAGE_SIZE = 50;
type Feed = Awaited<ReturnType<typeof wiVersionsFeed>>;
type VersionView = Awaited<ReturnType<typeof wiGetVersion>>;

function WiVersionsPage() {
  const feedFn = useServerFn(wiVersionsFeed);
  const versionFn = useServerFn(wiGetVersion);
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<(VersionView & { wi_code: string }) | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setFeed(await feedFn({ data: { token: requireToken(), page, pageSize: PAGE_SIZE } }));
    } catch (err) {
      showError(err);
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, [feedFn, page]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: string, wi_code: string) => {
    setOpening(id);
    try {
      const v = await versionFn({ data: { token: requireToken(), version_id: id } });
      setView({ ...v, wi_code });
    } catch (err) {
      showError(err);
    } finally {
      setOpening(null);
    }
  };

  const totalPages = feed ? Math.max(1, Math.ceil(feed.total / PAGE_SIZE)) : 1;

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 pb-12 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ประวัติเวอร์ชัน</h1>
        <p className="text-sm text-muted-foreground">
          ทุกฉบับที่เคยเผยแพร่ถูกเก็บไว้แบบแก้ไขไม่ได้ เพื่อใช้ตรวจย้อนหลัง
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error && !feed ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" className="h-10 gap-1" onClick={load}>
              <RefreshCw className="h-4 w-4" /> ลองใหม่
            </Button>
          </div>
        ) : !feed ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : feed.rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">ยังไม่มี WI ที่เผยแพร่</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WI</TableHead>
                  <TableHead>เวอร์ชัน</TableHead>
                  <TableHead>สรุปการเปลี่ยนแปลง</TableHead>
                  <TableHead>ผู้แก้ไข / ผู้อนุมัติ</TableHead>
                  <TableHead>เผยแพร่</TableHead>
                  <TableHead className="w-[80px]">
                    <span className="sr-only">ดู</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feed.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        to="/wi/$wiId"
                        params={{ wiId: r.wi_id }}
                        search={{ tab: "history" }}
                        className="underline-offset-2 hover:underline"
                      >
                        <span className="font-mono text-xs">{r.wi_code}</span>{" "}
                        <span className="font-medium">{r.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <WiVersionTag label={versionLabel(r.major, r.minor)} />
                      {r.is_current && (
                        <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-400">
                          ใช้งาน
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px] text-sm">
                      {r.change_summary || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.editor_name ?? "—"} / {r.reviewer_name ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatThaiDateTime(r.published_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1"
                        onClick={() => open(r.id, r.wi_code)}
                        disabled={opening === r.id}
                      >
                        {opening === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        ดู
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {feed && feed.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm text-muted-foreground">
            <span>
              หน้า {page}/{totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ก่อนหน้า
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {view?.wi_code} {view && versionLabel(view.version.major, view.version.minor)}
            </DialogTitle>
            <DialogDescription>สำเนาที่เผยแพร่ (แก้ไขไม่ได้)</DialogDescription>
          </DialogHeader>
          {view && (
            <WiViewer
              snapshot={view.snapshot}
              mediaUrls={view.mediaUrls}
              versionLabel={versionLabel(view.version.major, view.version.minor)}
              publishedAt={view.version.published_at}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
