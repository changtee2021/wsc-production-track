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
  ArrowLeft,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Printer,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  wiGet,
  wiGetVersion,
  wiLinkAdd,
  wiLinkRemove,
  wiRestore,
  wiRestoreVersion,
  type WiVersionRow,
} from "@/lib/features/wi.functions";
import { versionLabel, type WiSnapshot } from "@/lib/wi/wi-schema";
import {
  WI_ACCENT_BTN,
  WI_ACTIVITY_LABEL,
  formatThaiDateTime,
  requireWiActor,
} from "@/lib/wi/wi-client";
import { WiStatusBadge, WiVersionTag } from "@/components/wi/WiStatusBadge";
import { WiViewer } from "@/components/wi/WiViewer";
import { WiReadersPanel } from "@/components/wi/WiReadersPanel";

const TABS = ["content", "links", "reads", "history"] as const;
type Tab = (typeof TABS)[number];
// Older links/bookmarks used one tab per view; map them onto the merged tabs.
const LEGACY_TABS = ["draft", "published", "versions", "activity"] as const;
const LEGACY_TAB_MAP: Record<(typeof LEGACY_TABS)[number], Tab> = {
  draft: "content",
  published: "content",
  versions: "history",
  activity: "history",
};

export const Route = createFileRoute("/_protected/wi/$wiId/")({
  validateSearch: zodValidator(
    z.object({
      tab: fallback(z.enum([...TABS, ...LEGACY_TABS]), "content").default("content"),
      view: fallback(z.enum(["draft", "published"]).optional(), undefined),
    }),
  ),
  component: WiDetailPage,
});

const STAGES = [
  { key: "draft", label: "เขียนร่าง" },
  { key: "pending_review", label: "รอตรวจ" },
  { key: "published", label: "เผยแพร่ให้พนักงาน" },
] as const;

function StatusStepper({
  status,
  hasDraftChanges,
  liveLabel,
}: {
  status: "draft" | "pending_review" | "published";
  hasDraftChanges: boolean;
  liveLabel: string | null;
}) {
  const current = STAGES.findIndex((s) => s.key === status);
  const hint =
    status === "draft"
      ? "เขียนให้ครบ แล้วกด “ส่งตรวจ” ในหน้าแก้ไข"
      : status === "pending_review"
        ? "รอผู้อนุมัติตรวจ — ระหว่างนี้แก้ไขไม่ได้"
        : hasDraftChanges
          ? `พนักงานเห็น ${liveLabel ?? "ฉบับเดิม"} อยู่ · มีร่างแก้ไขที่ยังไม่ส่งตรวจ`
          : `พนักงานเห็น ${liveLabel ?? ""} แล้ว`;
  return (
    <div className="space-y-2">
      <ol className="flex items-center gap-1.5 text-xs sm:text-sm">
        {STAGES.map((s, i) => {
          const done = i < current || (status === "published" && i === current);
          const active = i === current;
          return (
            <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && !done && "border-amber-500 bg-amber-500 text-white",
                  !done && !active && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STAGES.length - 1 && (
                <span
                  className={cn(
                    "h-0.5 min-w-3 flex-1 rounded",
                    i < current ? "bg-emerald-500" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p
        className={cn(
          "text-sm",
          status === "published" && hasDraftChanges
            ? "text-amber-700 dark:text-amber-400"
            : "text-muted-foreground",
        )}
      >
        {hint}
      </p>
    </div>
  );
}

type Detail = Awaited<ReturnType<typeof wiGet>>;
type VersionView = Awaited<ReturnType<typeof wiGetVersion>>;

const ALL_CATS = "__all";

const REVIEW_LABEL = {
  submitted: "ส่งตรวจ",
  approved: "อนุมัติ",
  changes_requested: "ส่งกลับแก้ไข",
} as const;

function WiDetailPage() {
  const { wiId } = Route.useParams();
  const search = Route.useSearch();
  const tab: Tab = (TABS as readonly string[]).includes(search.tab)
    ? (search.tab as Tab)
    : LEGACY_TAB_MAP[search.tab as (typeof LEGACY_TABS)[number]];
  const legacyView =
    search.tab === "published" ? "published" : search.tab === "draft" ? "draft" : undefined;
  const navigate = useNavigate({ from: "/wi/$wiId/" });

  const getFn = useServerFn(wiGet);
  const versionFn = useServerFn(wiGetVersion);
  const restoreVersionFn = useServerFn(wiRestoreVersion);
  const duplicateFn = useServerFn(wiDuplicate);
  const archiveFn = useServerFn(wiArchive);
  const restoreFn = useServerFn(wiRestore);
  const linkAddFn = useServerFn(wiLinkAdd);
  const linkRemoveFn = useServerFn(wiLinkRemove);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<VersionView | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [viewVersion, setViewVersion] = useState<VersionView | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<WiVersionRow | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkStep, setLinkStep] = useState("");
  const [linkCat, setLinkCat] = useState(ALL_CATS);

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

  const currentVersionId = detail?.doc.current_version_id ?? null;
  const view = search.view ?? legacyView ?? "draft";
  const showPublished = tab === "content" && view === "published";
  useEffect(() => {
    if (!showPublished || !currentVersionId || published?.version.id === currentVersionId) {
      return;
    }
    setPublishedLoading(true);
    versionFn({ data: { token: requireToken(), version_id: currentVersionId } })
      .then(setPublished)
      .catch((err) => showError(err))
      .finally(() => setPublishedLoading(false));
  }, [showPublished, currentVersionId, published?.version.id, versionFn]);

  const openVersion = async (id: string) => {
    setLoadingVersionId(id);
    try {
      setViewVersion(await versionFn({ data: { token: requireToken(), version_id: id } }));
    } catch (err) {
      showError(err);
    } finally {
      setLoadingVersionId(null);
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

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
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </main>
    );
  }

  const { doc } = detail;
  const currentVersion = detail.versions.find((v) => v.id === doc.current_version_id) ?? null;
  const live = !!doc.current_version_id && doc.status !== "archived";
  const draftSnapshot: WiSnapshot = {
    wi_code: doc.wi_code,
    title: doc.title,
    description: doc.description,
    category_id: doc.category_id,
    category_name: detail.categories.find((c) => c.id === doc.category_id)?.name ?? null,
    owner_name: doc.owner_name,
    tags: doc.tags,
    est_minutes: doc.est_minutes,
    equipment: doc.equipment,
    safety_notes: doc.safety_notes,
    related_docs: doc.related_docs,
    steps: doc.steps,
    translations: doc.translations,
  };

  const versionsList =
    detail.versions.length === 0 ? (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        ยังไม่มีเวอร์ชันที่เผยแพร่
      </div>
    ) : (
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {detail.versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <WiVersionTag label={versionLabel(v.major, v.minor)} />
            {v.id === doc.current_version_id && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                ใช้งานอยู่
              </span>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <div>
                {v.change_summary || <span className="text-muted-foreground">(ไม่มีสรุป)</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                ผู้แก้ไข {v.editor_name ?? "—"} · ผู้อนุมัติ {v.reviewer_name ?? "—"} ·{" "}
                {formatThaiDateTime(v.published_at)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1"
              onClick={() => openVersion(v.id)}
              disabled={loadingVersionId === v.id}
            >
              {loadingVersionId === v.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              ดู
            </Button>
            {(doc.status === "draft" || doc.status === "published") && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-1"
                onClick={() => setRestoreTarget(v)}
              >
                <RotateCcw className="h-4 w-4" /> นำกลับมาเป็นร่าง
              </Button>
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-12 pt-2">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-10 gap-1 px-2">
        <Link to="/wi/library">
          <ArrowLeft className="h-4 w-4" /> คลัง WI
        </Link>
      </Button>

      <header className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{doc.wi_code}</span>
              <WiStatusBadge status={doc.status} />
              {currentVersion && (
                <WiVersionTag label={versionLabel(currentVersion.major, currentVersion.minor)} />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">
              {[
                draftSnapshot.category_name ?? "ไม่ระบุหมวด",
                doc.owner_name && `ผู้รับผิดชอบ ${doc.owner_name}`,
                `แก้ไขล่าสุด ${doc.updated_by_name ?? "—"} · ${formatThaiDateTime(doc.updated_at)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {(doc.status === "draft" || doc.status === "published") && (
              <Button asChild className={cn("h-11 gap-1.5 px-5", WI_ACCENT_BTN)}>
                <Link to="/wi/$wiId/edit" params={{ wiId: doc.id }}>
                  <Pencil className="h-4 w-4" />
                  {doc.status === "draft"
                    ? "แก้ไขร่าง"
                    : doc.has_unpublished_changes
                      ? "แก้ไขร่างต่อ"
                      : "แก้ไข"}
                </Link>
              </Button>
            )}
            {doc.status === "pending_review" && (
              <Button asChild className={cn("h-11 gap-1.5 px-5", WI_ACCENT_BTN)}>
                <Link to="/wi/review" search={{ id: doc.id }}>
                  <ClipboardList className="h-4 w-4" /> ไปตรวจ & อนุมัติ
                </Link>
              </Button>
            )}
            {doc.status === "archived" && (
              <Button
                className={cn("h-11 gap-1.5 px-5", WI_ACCENT_BTN)}
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      restoreFn({
                        data: { token: requireToken(), actor: requireWiActor(), id: doc.id },
                      }),
                    "กู้คืนแล้ว",
                  )
                }
              >
                <ArchiveRestore className="h-4 w-4" /> กู้คืน
              </Button>
            )}
            {live && (
              <Button asChild variant="outline" className="h-11 gap-1.5">
                <a href={`/manual/${doc.wi_code}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> หน้าพนักงาน
                </a>
              </Button>
            )}
            {live && (
              <Button asChild variant="outline" className="h-11 gap-1.5">
                <a href={`/manual/${doc.wi_code}/print`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4" /> พิมพ์
                </a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="ตัวเลือกเพิ่มเติม"
                  disabled={busy}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="min-h-10"
                  onSelect={async () => {
                    setBusy(true);
                    try {
                      const res = await duplicateFn({
                        data: { token: requireToken(), actor: requireWiActor(), id: doc.id },
                      });
                      toast.success(`คัดลอกเป็น ${res.wi_code} แล้ว`);
                      navigate({ to: "/wi/$wiId/edit", params: { wiId: res.id } });
                    } catch (err) {
                      showError(err);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Copy className="h-4 w-4" /> คัดลอกเป็น WI ใหม่
                </DropdownMenuItem>
                {doc.status !== "archived" && (
                  <DropdownMenuItem
                    className="min-h-10 text-destructive focus:text-destructive"
                    onSelect={() => setConfirmArchive(true)}
                  >
                    <Archive className="h-4 w-4" /> เก็บถาวร
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {doc.status === "archived" ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            เก็บถาวรแล้ว — พนักงานเปิดดูไม่ได้ กด “กู้คืน” เพื่อใช้งานอีกครั้ง
          </p>
        ) : (
          <div className="border-t border-border pt-4">
            <StatusStepper
              status={doc.status}
              hasDraftChanges={!!currentVersion && doc.has_unpublished_changes}
              liveLabel={
                currentVersion ? versionLabel(currentVersion.major, currentVersion.minor) : null
              }
            />
          </div>
        )}
      </header>

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab } })}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="content" className="min-h-10 px-4">
            เนื้อหา
          </TabsTrigger>
          <TabsTrigger value="links" className="min-h-10 px-4">
            ผูกงานผลิต
            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
              {detail.links.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="reads" className="min-h-10 px-4">
            การอ่าน
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 px-4">
            ประวัติ
            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
              {detail.versions.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reads" className="mt-4">
          {tab === "reads" && (
            <WiReadersPanel
              wiId={doc.id}
              liveVersion={
                live && currentVersion
                  ? versionLabel(currentVersion.major, currentVersion.minor)
                  : null
              }
            />
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-4 space-y-3">
          {doc.current_version_id && (
            <div
              role="radiogroup"
              aria-label="เลือกฉบับที่จะดู"
              className="inline-flex rounded-xl bg-muted p-1"
            >
              {(
                [
                  ["draft", "ร่างล่าสุด"],
                  ["published", "ฉบับที่พนักงานเห็น"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => navigate({ search: { tab: "content", view: v } })}
                  className={cn(
                    "min-h-10 rounded-lg px-4 text-sm font-medium transition-colors",
                    view === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {view === "draft" || !doc.current_version_id ? (
            <div className="rounded-xl border border-border bg-background p-4 sm:p-6">
              <WiViewer
                snapshot={draftSnapshot}
                mediaUrls={detail.mediaUrls}
                isPreview={doc.status !== "published"}
              />
            </div>
          ) : publishedLoading || !published ? (
            <Skeleton className="h-[360px] rounded-xl" />
          ) : (
            <div className="space-y-2">
              {doc.status === "archived" && (
                <p className="text-sm text-muted-foreground">
                  WI ถูกเก็บถาวร — พนักงานเปิดดูไม่ได้
                </p>
              )}
              <div className="rounded-xl border border-border bg-background p-4 sm:p-6">
                <WiViewer
                  snapshot={published.snapshot}
                  mediaUrls={published.mediaUrls}
                  versionLabel={versionLabel(published.version.major, published.version.minor)}
                  publishedAt={published.version.published_at}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="links" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            ผูก WI กับขั้นตอนการผลิตที่มีอยู่ เมื่อพนักงานเลือกขั้นตอนนี้ในหน้าสแกน จะมีปุ่ม
            “ดูคู่มือ” ขึ้นมา (แสดงเฉพาะ WI ที่เผยแพร่แล้ว และไม่เปลี่ยนสถานะงาน)
          </p>
          {detail.links.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              ยังไม่ได้ผูกกับขั้นตอนการผลิต
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {detail.links.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{l.step_name}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {l.category_name ?? "ทุกหมวดสินค้า"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    aria-label="ยกเลิกการผูก"
                    disabled={busy || doc.status === "archived"}
                    onClick={() =>
                      run(
                        () =>
                          linkRemoveFn({
                            data: {
                              token: requireToken(),
                              actor: requireWiActor(),
                              wi_id: doc.id,
                              link_id: l.id,
                            },
                          }),
                        "ยกเลิกการผูกแล้ว",
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {doc.status !== "archived" && (
            <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>ขั้นตอนการผลิต</Label>
                <Select value={linkStep} onValueChange={setLinkStep}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="เลือกขั้นตอน" />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.productionSteps.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.step_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>หมวดสินค้า</Label>
                <Select value={linkCat} onValueChange={setLinkCat}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATS}>ทุกหมวดสินค้า</SelectItem>
                    {detail.productionCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="h-10 gap-1"
                disabled={!linkStep || busy}
                onClick={() =>
                  run(async () => {
                    await linkAddFn({
                      data: {
                        token: requireToken(),
                        actor: requireWiActor(),
                        wi_id: doc.id,
                        step_id: linkStep,
                        category_id: linkCat === ALL_CATS ? null : linkCat,
                      },
                    });
                    setLinkStep("");
                    setLinkCat(ALL_CATS);
                  }, "ผูกกับงานผลิตแล้ว")
                }
              >
                <Plus className="h-4 w-4" /> ผูก
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">เวอร์ชันที่เผยแพร่</h2>
            {versionsList}
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-3 font-semibold">การตรวจ</h2>
              {detail.reviews.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">ยังไม่มีการส่งตรวจ</p>
              ) : (
                <ul className="divide-y divide-border">
                  {detail.reviews.map((r) => (
                    <li key={r.id} className="px-4 py-3 text-sm">
                      <div className="font-medium">
                        {REVIEW_LABEL[r.outcome]} · {r.actor_name}
                      </div>
                      {r.comment && <p className="whitespace-pre-wrap">{r.comment}</p>}
                      <div className="text-xs text-muted-foreground">
                        {formatThaiDateTime(r.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-3 font-semibold">กิจกรรม</h2>
              {detail.activity.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">ยังไม่มีกิจกรรม</p>
              ) : (
                <ul className="divide-y divide-border">
                  {detail.activity.map((a) => (
                    <li key={a.id} className="px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium">
                          {WI_ACTIVITY_LABEL[a.action] ?? a.action}
                        </span>
                        {typeof a.detail?.version === "string" && (
                          <span className="ml-1 font-mono text-xs">v{a.detail.version}</span>
                        )}
                        {typeof a.detail?.restored_from_version === "string" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (จาก {a.detail.restored_from_version})
                          </span>
                        )}
                        {typeof a.detail?.step_name === "string" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({a.detail.step_name})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.actor_name ?? "—"} · {formatThaiDateTime(a.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewVersion} onOpenChange={(o) => !o && setViewVersion(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {doc.wi_code}{" "}
              {viewVersion && versionLabel(viewVersion.version.major, viewVersion.version.minor)}
            </DialogTitle>
            <DialogDescription>สำเนาที่เผยแพร่ (แก้ไขไม่ได้)</DialogDescription>
          </DialogHeader>
          {viewVersion && (
            <WiViewer
              snapshot={viewVersion.snapshot}
              mediaUrls={viewVersion.mediaUrls}
              versionLabel={versionLabel(viewVersion.version.major, viewVersion.version.minor)}
              publishedAt={viewVersion.version.published_at}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              นำ {restoreTarget && versionLabel(restoreTarget.major, restoreTarget.minor)}{" "}
              กลับมาเป็นร่าง?
            </AlertDialogTitle>
            <AlertDialogDescription>
              เนื้อหาร่างปัจจุบันจะถูกแทนที่ด้วยเวอร์ชันนี้ ประวัติเวอร์ชันทั้งหมดยังอยู่ครบ
              และต้องส่งตรวจ/อนุมัติใหม่ก่อนพนักงานจะเห็น
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = restoreTarget;
                if (!target) return;
                setRestoreTarget(null);
                run(
                  () =>
                    restoreVersionFn({
                      data: {
                        token: requireToken(),
                        actor: requireWiActor(),
                        id: doc.id,
                        version_id: target.id,
                      },
                    }),
                  "นำเวอร์ชันเดิมกลับมาเป็นร่างแล้ว",
                );
              }}
            >
              นำกลับมาเป็นร่าง
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เก็บถาวร {doc.wi_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              WI จะหายจากรายการปกติ และพนักงานจะเปิดดูจากหน้างานไม่ได้ ประวัติยังเก็บไว้ครบ
              กู้คืนได้ภายหลัง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                run(
                  () =>
                    archiveFn({
                      data: { token: requireToken(), actor: requireWiActor(), id: doc.id },
                    }),
                  "เก็บถาวรแล้ว",
                )
              }
            >
              เก็บถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
