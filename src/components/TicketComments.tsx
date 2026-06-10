// Admin-side ticket comments thread (uses admin token)
import { useRef, useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, MessageCircle, ImagePlus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminListComments,
  adminAddComment,
  adminDeleteComment,
  createAdminCommentUploadUrl,
  type TicketCommentRow,
} from "@/lib/features/feedback.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Pending = { id: string; file: File; url: string };

function fmt(s: string) {
  try { return new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }); }
  catch { return s; }
}

export function TicketComments({ ticketId }: { ticketId: string }) {
  const listFn = useServerFn(adminListComments);
  const addFn = useServerFn(adminAddComment);
  const delFn = useServerFn(adminDeleteComment);
  const urlFn = useServerFn(createAdminCommentUploadUrl);

  const [rows, setRows] = useState<TicketCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [shots, setShots] = useState<Pending[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFn({ data: { adminToken: requireToken(), ticket_id: ticketId } });
      setRows(data);
    } catch (e) { showError(e, "โหลดคอมเมนต์ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [listFn, ticketId]);

  useEffect(() => { load(); }, [load]);

  const addFiles = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setShots((prev) => {
      const room = Math.max(0, 4 - prev.length);
      return [
        ...prev,
        ...imgs.slice(0, room).map((file) => ({
          id: crypto.randomUUID(), file, url: URL.createObjectURL(file),
        })),
      ];
    });
  };
  const removeShot = (id: string) =>
    setShots((prev) => {
      const f = prev.find((s) => s.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((s) => s.id !== id);
    });

  const send = async () => {
    if (body.trim().length === 0 && shots.length === 0) return;
    setSending(true);
    try {
      const token = requireToken();
      const paths: string[] = [];
      for (const s of shots) {
        const ext = s.file.type === "image/png" ? "png" : "jpg";
        const signed = await urlFn({ data: { adminToken: token, ext } });
        const { error } = await supabase.storage
          .from("feedback-media")
          .uploadToSignedUrl(signed.path, signed.token, s.file, {
            contentType: s.file.type, upsert: false,
          });
        if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);
        paths.push(signed.path);
      }
      await addFn({
        data: { adminToken: token, ticket_id: ticketId, body: body.trim(), image_paths: paths, author_name: "แอดมิน" },
      });
      shots.forEach((s) => URL.revokeObjectURL(s.url));
      setShots([]);
      setBody("");
      await load();
    } catch (e) { showError(e, "ส่งคอมเมนต์ไม่สำเร็จ"); }
    finally { setSending(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบคอมเมนต์นี้?")) return;
    try {
      await delFn({ data: { adminToken: requireToken(), id } });
      await load();
    } catch (e) { showError(e, "ลบไม่สำเร็จ"); }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> คอมเมนต์/อัปเดต ({rows.length})
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังโหลด...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีคอมเมนต์</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id} className="rounded-md bg-background p-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{c.author_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{fmt(c.created_at)}</span>
                  <button type="button" onClick={() => remove(c.id)} aria-label="ลบ" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {c.body && <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>}
              {c.image_urls?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.image_urls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border">
                      <img src={u} alt="" className="h-20 w-20 object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {shots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shots.map((s) => (
            <div key={s.id} className="relative">
              <img src={s.url} alt="" className="h-16 w-16 rounded-md border object-cover" />
              <button type="button" onClick={() => removeShot(s.id)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
            if (imgs.length) { e.preventDefault(); addFiles(imgs); }
          }}
          placeholder="เขียนคอมเมนต์/อัปเดต... (วางรูปได้)"
          rows={2}
          maxLength={2000}
          className="resize-none text-sm"
        />
        <div className="flex flex-col gap-1">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <Button size="sm" variant="outline" type="button"
            onClick={() => fileRef.current?.click()} disabled={shots.length >= 4} title="แนบรูป">
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={send} disabled={sending || (body.trim().length === 0 && shots.length === 0)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
