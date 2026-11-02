import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import {
  wiApprove,
  wiCheckReviewer,
  wiGet,
  wiList,
  wiRequestChanges,
  wiReviewerLogin,
} from "@/lib/features/wi.functions";
import {
  clearWiReviewSession,
  getWiReviewToken,
  setWiReviewToken,
} from "@/lib/auth/wi-review-session";
import { versionLabel, type WiSnapshot } from "@/lib/wi/wi-schema";
import {
  ACTOR_NEEDED_EVENT,
  WI_ACCENT_BTN,
  formatThaiDateTime,
  requireWiActor,
  useWiActor,
} from "@/lib/wi/wi-client";
import { WiViewer } from "@/components/wi/WiViewer";

export const Route = createFileRoute("/_protected/wi/review")({
  validateSearch: zodValidator(z.object({ id: fallback(z.string(), "").default("") })),
  component: WiReviewPage,
});

type ListData = Awaited<ReturnType<typeof wiList>>;
type Detail = Awaited<ReturnType<typeof wiGet>>;

function ReviewerGate({ onUnlocked }: { onUnlocked: () => void }) {
  const loginFn = useServerFn(wiReviewerLogin);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await loginFn({ data: { password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setWiReviewToken(res.token);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#E32D24]" />
        <h2 className="font-semibold">สำหรับผู้อนุมัติ WI</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        การอนุมัติ/เผยแพร่ใช้รหัสผู้อนุมัติแยกจากรหัสแอดมิน
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="wi-review-pw">รหัสผู้อนุมัติ</Label>
        <Input
          id="wi-review-pw"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          aria-invalid={!!error}
          className="h-11"
          autoFocus
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" className={cn("h-11 w-full gap-1", WI_ACCENT_BTN)} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        เข้าสู่โหมดอนุมัติ
      </Button>
    </form>
  );
}

function WiReviewPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/wi/review" });
  const [actor] = useWiActor();
  const checkFn = useServerFn(wiCheckReviewer);
  const listFn = useServerFn(wiList);
  const getFn = useServerFn(wiGet);
  const approveFn = useServerFn(wiApprove);
  const changesFn = useServerFn(wiRequestChanges);

  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [list, setList] = useState<ListData | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialog, setDialog] = useState<"approve" | "changes" | null>(null);
  const [bump, setBump] = useState<"minor" | "major">("minor");
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = getWiReviewToken();
    if (!t) {
      setUnlocked(false);
      return;
    }
    checkFn({ data: { token: t } })
      .then((r) => {
        if (!r.ok) clearWiReviewSession();
        setUnlocked(r.ok);
      })
      .catch(() => setUnlocked(false));
  }, [checkFn]);

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      setList(
        await listFn({
          data: {
            token: requireToken(),
            status: "pending_review",
            sort: "updated",
            dir: "asc",
            pageSize: 200,
          },
        }),
      );
    } catch (err) {
      showError(err);
      setListError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, [listFn]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getFn({ data: { token: requireToken(), id } })
      .then(setDetail)
      .catch((err) => showError(err))
      .finally(() => setDetailLoading(false));
  }, [id, getFn]);

  useEffect(() => {
    if (!id && list && list.rows.length > 0) {
      navigate({ search: { id: list.rows[0].id }, replace: true });
    }
  }, [id, list, navigate]);

  const reviewToken = () => {
    const t = getWiReviewToken();
    if (!t) {
      setUnlocked(false);
      throw new Error("กรุณาใส่รหัสผู้อนุมัติอีกครั้ง");
    }
    return t;
  };

  const handleReviewError = (err: unknown) => {
    if (err instanceof Error && err.message === "ReviewerUnauthorized") {
      clearWiReviewSession();
      setUnlocked(false);
      toast.error("รหัสผู้อนุมัติหมดอายุ — ใส่ใหม่อีกครั้ง");
      return;
    }
    showError(err);
  };

  const afterDecision = async () => {
    setDialog(null);
    setComment("");
    navigate({ search: { id: "" }, replace: true });
    await loadList();
  };

  const approve = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await approveFn({
        data: {
          reviewToken: reviewToken(),
          reviewer: requireWiActor(),
          id: detail.doc.id,
          bump,
          comment,
        },
      });
      toast.success(`เผยแพร่ ${detail.doc.wi_code} ${res.version} แล้ว`);
      await afterDecision();
    } catch (err) {
      handleReviewError(err);
    } finally {
      setBusy(false);
    }
  };

  const requestChanges = async () => {
    if (!detail) return;
    if (!comment.trim()) {
      setCommentError("กรอกสิ่งที่ต้องแก้ไข");
      return;
    }
    setBusy(true);
    try {
      await changesFn({
        data: {
          reviewToken: reviewToken(),
          reviewer: requireWiActor(),
          id: detail.doc.id,
          comment,
        },
      });
      toast.success("ส่งกลับให้แก้ไขแล้ว");
      await afterDecision();
    } catch (err) {
      handleReviewError(err);
    } finally {
      setBusy(false);
    }
  };

  const doc = detail?.doc;
  const latest = detail?.versions[0] ?? null;
  const nextMinor = latest ? versionLabel(latest.major, latest.minor + 1) : "v1.0";
  const nextMajor = latest ? versionLabel(latest.major + 1, 0) : "v1.0";
  const sameAsSubmitter =
    !!doc?.submitted_by_name &&
    actor.trim().toLowerCase() === doc.submitted_by_name.trim().toLowerCase();

  const snapshot: WiSnapshot | null = doc
    ? {
        wi_code: doc.wi_code,
        title: doc.title,
        description: doc.description,
        category_id: doc.category_id,
        category_name: detail?.categories.find((c) => c.id === doc.category_id)?.name ?? null,
        owner_name: doc.owner_name,
        tags: doc.tags,
        est_minutes: doc.est_minutes,
        equipment: doc.equipment,
        safety_notes: doc.safety_notes,
        related_docs: doc.related_docs,
        steps: doc.steps,
        translations: doc.translations,
      }
    : null;

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 pb-12 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ตรวจ & อนุมัติ WI</h1>
          <p className="text-sm text-muted-foreground">
            ตรวจเนื้อหาตามที่พนักงานจะเห็น แล้วอนุมัติเผยแพร่หรือส่งกลับแก้ไข
          </p>
        </div>
        {unlocked && (
          <Button
            variant="outline"
            className="h-10 gap-1"
            onClick={() => {
              clearWiReviewSession();
              setUnlocked(false);
            }}
          >
            <LogOut className="h-4 w-4" /> ออกจากโหมดอนุมัติ
          </Button>
        )}
      </div>

      {unlocked === false && <ReviewerGate onUnlocked={() => setUnlocked(true)} />}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">รอตรวจ ({list?.total ?? "…"})</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={loadList}
              aria-label="รีเฟรช"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {listError && !list ? (
            <div className="space-y-2 p-4 text-sm">
              <p className="text-destructive">{listError}</p>
              <Button variant="outline" size="sm" className="h-9" onClick={loadList}>
                ลองใหม่
              </Button>
            </div>
          ) : !list ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : list.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ไม่มี WI รอตรวจ
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ search: { id: r.id } })}
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm hover:bg-muted/50",
                      r.id === id && "bg-muted",
                    )}
                  >
                    <div className="font-mono text-xs text-muted-foreground">{r.wi_code}</div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.category_name ?? "—"} · {formatThaiDateTime(r.updated_at)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          {detailLoading ? (
            <Skeleton className="h-[420px] rounded-xl" />
          ) : !doc || !snapshot ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              เลือก WI ทางซ้ายเพื่อตรวจ
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link
                    to="/wi/$wiId"
                    params={{ wiId: doc.id }}
                    className="font-mono font-semibold underline-offset-2 hover:underline"
                  >
                    {doc.wi_code}
                  </Link>
                  <span className="text-muted-foreground">
                    ส่งโดย {doc.submitted_by_name ?? "—"} · {formatThaiDateTime(doc.submitted_at)}
                  </span>
                  {latest && (
                    <span className="text-muted-foreground">
                      · ฉบับปัจจุบัน {versionLabel(latest.major, latest.minor)}
                    </span>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="text-xs font-semibold text-muted-foreground">
                    สรุปการเปลี่ยนแปลง
                  </div>
                  <p className="whitespace-pre-wrap">
                    {doc.pending_change_summary || (latest ? "(ไม่ได้ระบุ)" : "ฉบับแรก")}
                  </p>
                </div>
                {doc.status !== "pending_review" ? (
                  <p className="text-sm text-muted-foreground">WI นี้ไม่ได้อยู่ในสถานะรอตรวจแล้ว</p>
                ) : !unlocked ? (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />{" "}
                    ใส่รหัสผู้อนุมัติด้านบนเพื่ออนุมัติหรือส่งกลับ
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    อ่านเนื้อหาด้านล่างตามที่พนักงานจะเห็น แล้วตัดสินใจที่แถบด้านล่างจอ
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-background p-4 sm:p-6">
                <WiViewer snapshot={snapshot} mediaUrls={detail?.mediaUrls ?? {}} isPreview />
              </div>
              {doc.status === "pending_review" && unlocked && (
                <div className="sticky bottom-3 z-10 space-y-2 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
                  {sameAsSubmitter && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      คุณเป็นผู้ส่งตรวจ WI นี้ — ต้องให้คนอื่นเป็นผู้อนุมัติ
                    </p>
                  )}
                  {!actor && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      ใส่ชื่อผู้อนุมัติก่อน{" "}
                      <button
                        type="button"
                        className="font-semibold underline underline-offset-2"
                        onClick={() => window.dispatchEvent(new Event(ACTOR_NEEDED_EVENT))}
                      >
                        ใส่ชื่อ
                      </button>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto hidden min-w-0 truncate text-sm sm:block">
                      <span className="font-mono text-xs text-muted-foreground">{doc.wi_code}</span>{" "}
                      <span className="font-semibold">{doc.title}</span>
                    </span>
                    <Button
                      variant="outline"
                      className="h-11 flex-1 gap-1 sm:flex-none"
                      disabled={!actor}
                      onClick={() => {
                        setComment("");
                        setCommentError("");
                        setDialog("changes");
                      }}
                    >
                      <Undo2 className="h-4 w-4" /> ส่งกลับแก้ไข
                    </Button>
                    <Button
                      className={cn("h-11 flex-1 gap-1 px-5 sm:flex-none", WI_ACCENT_BTN)}
                      disabled={sameAsSubmitter || !actor}
                      onClick={() => {
                        setComment("");
                        setBump("minor");
                        setDialog("approve");
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> อนุมัติ & เผยแพร่
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog open={dialog === "approve"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อนุมัติ & เผยแพร่ {doc?.wi_code}</DialogTitle>
            <DialogDescription>
              พนักงานจะเห็นฉบับนี้ทันที ฉบับก่อนหน้ายังเก็บไว้ในประวัติ (แก้ไขไม่ได้)
            </DialogDescription>
          </DialogHeader>
          {latest ? (
            <RadioGroup
              value={bump}
              onValueChange={(v) => setBump(v as "minor" | "major")}
              className="space-y-2"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="minor" />
                <div>
                  <div className="font-medium">แก้เล็กน้อย → {nextMinor}</div>
                  <div className="text-xs text-muted-foreground">
                    แก้คำผิด เปลี่ยนรูป เพิ่มรายละเอียด — วิธีทำเหมือนเดิม
                  </div>
                </div>
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="major" />
                <div>
                  <div className="font-medium">เปลี่ยนวิธีทำ → {nextMajor}</div>
                  <div className="text-xs text-muted-foreground">
                    เปลี่ยนขั้นตอนหรือลำดับ — พนักงานควรอ่านใหม่
                  </div>
                </div>
              </label>
            </RadioGroup>
          ) : (
            <p className="text-sm">
              จะเผยแพร่เป็น <span className="font-mono">v1.0</span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="approve-comment">ความเห็น (ไม่บังคับ)</Label>
            <Textarea
              id="approve-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button className={cn("h-10 gap-1", WI_ACCENT_BTN)} onClick={approve} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              อนุมัติ & เผยแพร่
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "changes"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ส่งกลับแก้ไข {doc?.wi_code}</DialogTitle>
            <DialogDescription>WI จะกลับเป็นร่างให้ผู้เขียนแก้ไขและส่งตรวจใหม่</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="changes-comment">
              สิ่งที่ต้องแก้ไข <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="changes-comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setCommentError("");
              }}
              rows={3}
              maxLength={1000}
              aria-invalid={!!commentError}
            />
            {commentError && <p className="text-xs text-destructive">{commentError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button className="h-10 gap-1" onClick={requestChanges} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              ส่งกลับแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
