// FAB feedback button — floats bottom-right on every page
import { useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquarePlus, Send, Loader2, Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  submitFeedback,
  createFeedbackUploadUrl,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  PRIORITY_LABEL,
  CATEGORY_LABEL,
  type TicketPriority,
  type TicketCategory,
} from "@/lib/features/feedback.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

const MAX_IMAGES = 4;
type Shot = { id: string; file: File; url: string };

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [form, setForm] = useState({
    from_name: "",
    from_emp_code: "",
    subject: "",
    message: "",
    category: "bug" as TicketCategory,
    priority: "normal" as TicketPriority,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const submit = useServerFn(submitFeedback);
  const createUrl = useServerFn(createFeedbackUploadUrl);

  const reset = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setForm({ from_name: "", from_emp_code: "", subject: "", message: "", category: "bug", priority: "normal" });
  };

  const addFiles = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setShots((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) { toast.error(`แนบรูปได้สูงสุด ${MAX_IMAGES} รูป`); return prev; }
      const next = imgs.slice(0, room).map((file) => ({
        id: crypto.randomUUID(), file, url: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const removeShot = (id: string) => {
    setShots((prev) => {
      const f = prev.find((s) => s.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((s) => s.id !== id);
    });
  };

  const captureScreen = async () => {
    setCapturing(true);
    setOpen(false);
    await new Promise((r) => setTimeout(r, 250));
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(document.body, {
        logging: false, useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
      });
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/png", 0.92),
      );
      if (blob) {
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
        addFiles([file]);
        toast.success("แคปหน้าจอแล้ว");
      }
    } catch {
      toast.error("แคปหน้าจอไม่สำเร็จ");
    } finally {
      setCapturing(false);
      setOpen(true);
    }
  };

  const handleSubmit = async () => {
    if (form.subject.trim().length < 2 || form.message.trim().length < 2) {
      toast.error("กรุณากรอกหัวข้อและรายละเอียด");
      return;
    }
    setSubmitting(true);
    try {
      // upload images via signed urls
      const paths: string[] = [];
      for (const s of shots) {
        const ext = s.file.type === "image/png" ? "png" : "jpg";
        const signed = await createUrl({ data: { ext } });
        const { error } = await supabase.storage
          .from("feedback-media")
          .uploadToSignedUrl(signed.path, signed.token, s.file, {
            contentType: s.file.type, upsert: false,
          });
        if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);
        paths.push(signed.path);
      }
      const res = await submit({
        data: {
          from_name: form.from_name || null,
          from_emp_code: form.from_emp_code || null,
          from_phone: null,
          category: form.category,
          priority: form.priority,
          subject: form.subject,
          message: form.message,
          page_path: path,
          image_paths: paths,
        },
      });
      toast.success(`ส่งเรียบร้อย ${res.ticket_no ? `#${res.ticket_no}` : ""} ขอบคุณครับ`);
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Toaster richColors position="top-center" />
      <Button
        type="button"
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-4 right-4 z-[60] h-11 w-11 rounded-full shadow-lg shadow-primary/30"
        aria-label="ส่งความคิดเห็น/แจ้งปัญหา"
        title="ส่งความคิดเห็น/แจ้งปัญหา"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ส่งความคิดเห็น/แจ้งปัญหา</DialogTitle>
            <DialogDescription className="text-xs">
              หน้า: <span className="font-mono">{path}</span> — แนบรูปหรือแคปหน้าจอเพื่ออธิบายให้ละเอียดขึ้นได้
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="ชื่อ (ไม่บังคับ)" value={form.from_name} maxLength={120}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
            <Input placeholder="รหัสพนักงาน" value={form.from_emp_code} maxLength={40}
              onChange={(e) => setForm({ ...form, from_emp_code: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}>
              <SelectTrigger className="h-9 flex-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input placeholder="หัวข้อสั้น ๆ *" value={form.subject} maxLength={200}
            onChange={(e) => setForm({ ...form, subject: e.target.value })} />

          <Textarea
            placeholder="รายละเอียด... (วางรูปได้)"
            value={form.message}
            maxLength={5000}
            rows={5}
            className="resize-none"
            onPaste={(e) => {
              const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
              if (imgs.length) { e.preventDefault(); addFiles(imgs); }
            }}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />

          {shots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {shots.map((s) => (
                <div key={s.id} className="relative h-20 w-20 overflow-hidden rounded-md border">
                  <img src={s.url} alt="แนบ" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeShot(s.id)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 shadow"
                    aria-label="ลบรูป">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={captureScreen}
              disabled={capturing || submitting || shots.length >= MAX_IMAGES}>
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              แคปหน้าจอ
            </Button>
            <Button type="button" variant="outline" size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={submitting || shots.length >= MAX_IMAGES}>
              <ImagePlus className="h-4 w-4" /> แนบรูป
            </Button>
            <input
              ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={submitting || form.subject.trim().length < 2 || form.message.trim().length < 2}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
