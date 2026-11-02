import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import {
  wiArchive,
  wiDuplicate,
  wiList,
  wiRestore,
  type WiListRow,
} from "@/lib/features/wi.functions";
import { WI_STATUS_LABEL, WI_STATUSES, versionLabel } from "@/lib/wi/wi-schema";
import { WI_ACCENT_BTN, formatThaiDateTime, requireWiActor } from "@/lib/wi/wi-client";
import { WiStatusBadge, WiVersionTag } from "@/components/wi/WiStatusBadge";

const ALL = "__all";
const PAGE_SIZE = 50;

type StatusFilter = "active" | "all" | (typeof WI_STATUSES)[number];
const STATUS_CHIPS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: "active", label: "ใช้งานอยู่" },
  { value: "published", label: WI_STATUS_LABEL.published, dot: "bg-emerald-500" },
  { value: "pending_review", label: WI_STATUS_LABEL.pending_review, dot: "bg-amber-500" },
  { value: "draft", label: WI_STATUS_LABEL.draft, dot: "bg-slate-400" },
  { value: "archived", label: WI_STATUS_LABEL.archived, dot: "bg-zinc-400" },
  { value: "all", label: "ทั้งหมด" },
];

const searchSchema = z.object({
  q: fallback(z.string().max(100), "").default(""),
  category: fallback(z.string(), "").default(""),
  status: fallback(z.enum(["active", "all", ...WI_STATUSES]), "active").default("active"),
  owner: fallback(z.string().max(120), "").default(""),
  sort: fallback(z.enum(["updated", "created", "title", "code"]), "updated").default("updated"),
  dir: fallback(z.enum(["asc", "desc"]), "desc").default("desc"),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/_protected/wi/library")({
  validateSearch: zodValidator(searchSchema),
  component: WiLibraryPage,
});

type ListData = Awaited<ReturnType<typeof wiList>>;
type SortKey = "updated" | "created" | "title" | "code";

function WiLibraryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/wi/library" });
  const listFn = useServerFn(wiList);
  const duplicateFn = useServerFn(wiDuplicate);
  const archiveFn = useServerFn(wiArchive);
  const restoreFn = useServerFn(wiRestore);

  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(search.q);
  const [confirm, setConfirm] = useState<{ row: WiListRow; kind: "archive" | "restore" } | null>(
    null,
  );

  useEffect(() => setQ(search.q), [search.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() !== search.q) navigate({ search: (s) => ({ ...s, q: q.trim(), page: 1 }) });
    }, 350);
    return () => clearTimeout(t);
  }, [q, search.q, navigate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFn({
        data: {
          token: requireToken(),
          q: search.q,
          category_id: search.category || null,
          status: search.status,
          owner: search.owner || null,
          sort: search.sort,
          dir: search.dir,
          page: search.page,
          pageSize: PAGE_SIZE,
        },
      });
      setData(res);
    } catch (err) {
      showError(err);
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [listFn, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch, page: patch.page ?? 1 }) });

  const toggleSort = (key: SortKey) =>
    setSearch(
      search.sort === key
        ? { dir: search.dir === "asc" ? "desc" : "asc" }
        : { sort: key, dir: key === "title" || key === "code" ? "asc" : "desc" },
    );

  const duplicate = async (row: WiListRow) => {
    try {
      const res = await duplicateFn({
        data: { token: requireToken(), actor: requireWiActor(), id: row.id },
      });
      toast.success(`คัดลอกเป็น ${res.wi_code} แล้ว`);
      navigate({ to: "/wi/$wiId/edit", params: { wiId: res.id } });
    } catch (err) {
      showError(err, "คัดลอกไม่สำเร็จ");
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    try {
      const args = { data: { token: requireToken(), actor: requireWiActor(), id: confirm.row.id } };
      if (confirm.kind === "archive") await archiveFn(args);
      else await restoreFn(args);
      toast.success(confirm.kind === "archive" ? "เก็บถาวรแล้ว" : "กู้คืนแล้ว");
      setConfirm(null);
      refresh();
    } catch (err) {
      showError(err);
    }
  };

  const hasFilter = !!search.q || !!search.category || search.status !== "active" || !!search.owner;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 font-medium hover:text-foreground",
        search.sort === k && "text-foreground",
      )}
    >
      {label}
      {search.sort === k &&
        (search.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        ))}
    </button>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 pb-12 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คลัง WI</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} ฉบับ` : "…"} · กดที่แถวเพื่อเปิดดู
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" className="h-11 gap-1">
            <Link to="/wi/versions">
              <History className="h-4 w-4" /> ประวัติเวอร์ชันทั้งหมด
            </Link>
          </Button>
          <Button asChild className={cn("h-11 gap-1", WI_ACCENT_BTN)}>
            <Link to="/wi/new">
              <Plus className="h-4 w-4" /> สร้าง WI
            </Link>
          </Button>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="กรองสถานะ"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {STATUS_CHIPS.map((c) => {
          const on = search.status === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSearch({ status: c.value })}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c.dot && <span className={cn("h-2 w-2 rounded-full", c.dot)} />}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ, รหัส WI, คำค้น"
            className="h-10 pl-9"
            aria-label="ค้นหา WI"
          />
        </div>
        <Select
          value={search.category || ALL}
          onValueChange={(v) => setSearch({ category: v === ALL ? "" : v })}
        >
          <SelectTrigger className="h-10 w-[180px]" aria-label="กรองหมวดหมู่">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกหมวด</SelectItem>
            {(data?.categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {!c.is_active ? " (เก็บถาวร)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.owner || ALL}
          onValueChange={(v) => setSearch({ owner: v === ALL ? "" : v })}
        >
          <SelectTrigger className="h-10 w-[170px]" aria-label="กรองผู้รับผิดชอบ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ผู้รับผิดชอบทั้งหมด</SelectItem>
            {(data?.owners ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            className="h-10 gap-1"
            onClick={() =>
              navigate({
                search: {
                  q: "",
                  category: "",
                  status: "active",
                  owner: "",
                  sort: search.sort,
                  dir: search.dir,
                  page: 1,
                },
              })
            }
          >
            <X className="h-4 w-4" /> ล้างตัวกรอง
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error && !data ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm">โหลดรายการไม่สำเร็จ: {error}</p>
            <Button variant="outline" className="h-10 gap-1" onClick={refresh}>
              <RefreshCw className="h-4 w-4" /> ลองใหม่
            </Button>
          </div>
        ) : !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            {hasFilter ? (
              <p className="text-sm text-muted-foreground">ไม่พบ WI ที่ตรงกับเงื่อนไข</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">ยังไม่มี WI ในระบบ</p>
                <Button asChild className={cn("h-11 gap-1", WI_ACCENT_BTN)}>
                  <Link to="/wi/new">
                    <Plus className="h-4 w-4" /> สร้าง WI แรก
                  </Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className={cn("overflow-x-auto", loading && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-3">
                      <SortButton k="code" label="รหัส" />
                      <SortButton k="title" label="ชื่อ WI" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[170px]">สถานะ</TableHead>
                  <TableHead className="hidden w-[170px] md:table-cell">
                    <SortButton k="updated" label="แก้ไขล่าสุด" />
                  </TableHead>
                  <TableHead className="w-[60px] text-right">
                    <span className="sr-only">จัดการ</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/wi/$wiId", params: { wiId: r.id } })}
                  >
                    <TableCell className="max-w-[420px] py-3">
                      <div className="font-mono text-[11px] text-muted-foreground">{r.wi_code}</div>
                      <Link
                        to="/wi/$wiId"
                        params={{ wiId: r.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[r.category_name ?? "ไม่ระบุหมวด", r.owner_name, ...r.tags]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <WiStatusBadge status={r.status} />
                        <WiVersionTag label={versionLabel(r.version?.major, r.version?.minor)} />
                      </div>
                      {r.version && r.has_unpublished_changes && r.status !== "archived" && (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                          มีร่างแก้ไขรอเผยแพร่
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                      {formatThaiDateTime(r.updated_at)}
                      {r.updated_by_name && <div>{r.updated_by_name}</div>}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            aria-label={`จัดการ ${r.wi_code}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link to="/wi/$wiId" params={{ wiId: r.id }}>
                              <Eye className="h-4 w-4" /> ดูรายละเอียด
                            </Link>
                          </DropdownMenuItem>
                          {(r.status === "draft" || r.status === "published") && (
                            <DropdownMenuItem asChild>
                              <Link to="/wi/$wiId/edit" params={{ wiId: r.id }}>
                                <Pencil className="h-4 w-4" />
                                {r.status === "draft" ? "แก้ไข / ส่งตรวจ" : "แก้ไขเป็นฉบับใหม่"}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => duplicate(r)}>
                            <Copy className="h-4 w-4" /> คัดลอก WI
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to="/wi/$wiId"
                              params={{ wiId: r.id }}
                              search={{ tab: "history" }}
                            >
                              <History className="h-4 w-4" /> ประวัติเวอร์ชัน
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {r.status === "archived" ? (
                            <DropdownMenuItem
                              onSelect={() => setConfirm({ row: r, kind: "restore" })}
                            >
                              <ArchiveRestore className="h-4 w-4" /> กู้คืน
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setConfirm({ row: r, kind: "archive" })}
                            >
                              <Archive className="h-4 w-4" /> เก็บถาวร
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm text-muted-foreground">
            <span>
              {data.total} รายการ · หน้า {search.page}/{totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={search.page <= 1}
                onClick={() => setSearch({ page: search.page - 1 })}
              >
                ก่อนหน้า
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={search.page >= totalPages}
                onClick={() => setSearch({ page: search.page + 1 })}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "archive" ? "เก็บถาวร" : "กู้คืน"} {confirm?.row.wi_code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "archive"
                ? "WI จะหายจากรายการปกติ และพนักงานจะเปิดดูจากหน้างานไม่ได้ ประวัติเวอร์ชันยังเก็บไว้ครบ กู้คืนได้ภายหลัง"
                : "WI จะกลับมาอยู่ในรายการ ถ้ามีฉบับเผยแพร่ พนักงานจะเปิดดูได้อีกครั้ง"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={runConfirm}
              className={
                confirm?.kind === "archive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {confirm?.kind === "archive" ? "เก็บถาวร" : "กู้คืน"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
