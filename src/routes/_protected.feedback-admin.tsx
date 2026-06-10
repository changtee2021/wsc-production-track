import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, MessageSquare, Trash2, Check, Eye } from "lucide-react";
import {
  adminListFeedback,
  adminUpdateFeedback,
  adminDeleteFeedback,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/features/feedback.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_protected/feedback-admin")({
  head: () => ({ meta: [{ title: "ความคิดเห็น — Admin" }] }),
  component: FeedbackAdminPage,
});

const CAT_LABEL: Record<string, string> = {
  bug: "บั๊ก",
  suggest: "เสนอแนะ",
  complain: "ร้องเรียน",
  praise: "ชมเชย",
  other: "อื่นๆ",
};

function fmt(s: string) {
  try {
    return new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

function FeedbackAdminPage() {
  const listFn = useServerFn(adminListFeedback);
  const updateFn = useServerFn(adminUpdateFeedback);
  const deleteFn = useServerFn(adminDeleteFeedback);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"all" | FeedbackStatus>("all");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFn({ data: { adminToken: requireToken(), status, limit: 200 } });
      setRows(data as FeedbackRow[]);
    } catch (e) {
      showError(e, "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [listFn, status]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, s: FeedbackStatus) => {
    try {
      await updateFn({ data: { adminToken: requireToken(), id, status: s } });
      toast.success("อัปเดตแล้ว");
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
    if (!confirm("ลบรายการนี้?")) return;
    try {
      await deleteFn({ data: { adminToken: requireToken(), id } });
      toast.success("ลบแล้ว");
      await load();
    } catch (e) { showError(e, "ลบไม่สำเร็จ"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <Toaster richColors position="top-center" />
      <div className="flex items-center gap-2">
        <MessageSquare className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">ความคิดเห็น/แจ้งปัญหา</h1>
      </div>
      <div className="flex gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="new">ใหม่</SelectItem>
            <SelectItem value="read">อ่านแล้ว</SelectItem>
            <SelectItem value="done">เสร็จสิ้น</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && !loading && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">ไม่มีรายการ</CardContent></Card>
        )}
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{CAT_LABEL[r.category] ?? r.category}</Badge>
                    {r.status === "new" && <Badge>ใหม่</Badge>}
                    {r.status === "read" && <Badge variant="secondary">อ่านแล้ว</Badge>}
                    {r.status === "done" && <Badge variant="outline">เสร็จสิ้น</Badge>}
                    <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                  </div>
                  <h3 className="mt-1 font-semibold">{r.subject}</h3>
                  <div className="text-xs text-muted-foreground">
                    {r.from_name || "ไม่ระบุชื่อ"}
                    {r.from_emp_code ? ` · ${r.from_emp_code}` : ""}
                    {r.from_phone ? ` · ☎ ${r.from_phone}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {r.status !== "read" && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "read")} title="อ่านแล้ว">
                      <Eye className="size-4" />
                    </Button>
                  )}
                  {r.status !== "done" && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "done")} title="เสร็จสิ้น">
                      <Check className="size-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)} title="ลบ">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              <div className="space-y-1">
                <Textarea
                  rows={2}
                  placeholder="หมายเหตุของแอดมิน"
                  value={noteDraft[r.id] ?? r.admin_note ?? ""}
                  onChange={(e) => setNoteDraft({ ...noteDraft, [r.id]: e.target.value })}
                />
                <Button size="sm" variant="outline" onClick={() => saveNote(r.id)}>บันทึกหมายเหตุ</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
