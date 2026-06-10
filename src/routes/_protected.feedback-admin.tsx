import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, MessageSquare, Trash2, ArrowRight, CheckCircle2, Inbox,
} from "lucide-react";
import {
  adminListFeedback,
  adminUpdateFeedback,
  adminDeleteFeedback,
  STATUS_LABEL, STATUS_BADGE,
  PRIORITY_LABEL, PRIORITY_BADGE,
  CATEGORY_LABEL,
  NEXT_STATUS,
  TICKET_STATUSES, TICKET_PRIORITIES,
  type TicketRow, type TicketStatus, type TicketPriority,
} from "@/lib/features/feedback.functions";
import { TicketComments } from "@/components/TicketComments";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_protected/feedback-admin")({
  head: () => ({ meta: [{ title: "Ticket — Admin" }] }),
  component: FeedbackAdminPage,
});

function fmt(s: string) {
  try { return new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }); }
  catch { return s; }
}

function FeedbackAdminPage() {
  const listFn = useServerFn(adminListFeedback);
  const updateFn = useServerFn(adminUpdateFeedback);
  const deleteFn = useServerFn(adminDeleteFeedback);
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFn({ data: { adminToken: requireToken(), status, priority, limit: 200 } });
      setRows(data as TicketRow[]);
    } catch (e) { showError(e, "โหลดไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [listFn, status, priority]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, s: TicketStatus) => {
    try {
      await updateFn({ data: { adminToken: requireToken(), id, status: s } });
      toast.success("อัปเดตแล้ว");
      await load();
    } catch (e) { showError(e, "อัปเดตไม่สำเร็จ"); }
  };
  const updatePriority = async (id: string, p: TicketPriority) => {
    try {
      await updateFn({ data: { adminToken: requireToken(), id, priority: p } });
      await load();
    } catch (e) { showError(e, "อัปเดตไม่สำเร็จ"); }
  };
  const saveNote = async (id: string) => {
    try {
      await updateFn({ data: { adminToken: requireToken(), id, admin_note: noteDraft[id] ?? "" } });
      toast.success("บันทึกหมายเหตุแล้ว");
      await load();
    } catch (e) { showError(e, "บันทึกไม่สำเร็จ"); }
  };
  const remove = async (id: string) => {
    if (!confirm("ลบ Ticket นี้ (รวมคอมเมนต์ทั้งหมด)?")) return;
    try {
      await deleteFn({ data: { adminToken: requireToken(), id } });
      toast.success("ลบแล้ว");
      await load();
    } catch (e) { showError(e, "ลบไม่สำเร็จ"); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <Toaster richColors position="top-center" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">ระบบ Ticket จากพนักงาน</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับ</SelectItem>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="โหลดใหม่">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Inbox className="h-10 w-10" />
          <p className="text-sm">ยังไม่มี Ticket</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const next = NEXT_STATUS[t.status];
            return (
              <Card key={t.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                        #{String(t.ticket_no ?? "—").padStart(3, "0")}
                      </span>
                      <span>{t.subject}</span>
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmt(t.created_at)}
                      {` · ${CATEGORY_LABEL[t.category] ?? t.category}`}
                      {t.from_name ? ` · ${t.from_name}` : ""}
                      {t.from_emp_code ? ` (${t.from_emp_code})` : ""}
                      {t.from_phone ? ` · ☎ ${t.from_phone}` : ""}
                      {t.page_path ? ` · ${t.page_path}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status])}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_BADGE[t.priority])}>
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm">{t.message}</p>

                  {t.image_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {t.image_urls.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer"
                          className="block h-24 w-24 overflow-hidden rounded-md border">
                          <img src={u} alt={`ภาพแนบ ${i + 1}`}
                            className="h-full w-full object-cover transition hover:scale-105" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={t.priority} onValueChange={(v) => updatePriority(t.id, v as TicketPriority)}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="ml-auto flex items-center gap-2">
                      {next && (
                        <Button size="sm" onClick={() => updateStatus(t.id, next)}>
                          {STATUS_LABEL[next]} <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                      {t.status !== "closed" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(t.id, "closed")}>
                          <CheckCircle2 className="h-4 w-4" /> ปิดงาน
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(t.id)} aria-label="ลบ">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Textarea
                      rows={2}
                      placeholder="หมายเหตุภายในของแอดมิน (ผู้แจ้งไม่เห็น)"
                      value={noteDraft[t.id] ?? t.admin_note ?? ""}
                      onChange={(e) => setNoteDraft({ ...noteDraft, [t.id]: e.target.value })}
                    />
                    <Button size="sm" variant="outline" onClick={() => saveNote(t.id)}>บันทึกหมายเหตุ</Button>
                  </div>

                  <TicketComments ticketId={t.id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
