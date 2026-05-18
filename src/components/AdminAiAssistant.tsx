import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAdminToken } from "@/lib/admin-session";
import { aiAdminAsk } from "@/lib/ai-admin.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "qa" | "plan";

const SUGGESTIONS: Record<Mode, string[]> = {
  qa: [
    "พนักงานคนไหนทำงานเสร็จมากสุดใน 30 วัน",
    "ขั้นตอนไหนใช้เวลาเฉลี่ยนานที่สุด",
    "มี QC report ค้างกี่รายการ",
  ],
  plan: [
    "แนะนำการจัดคนสำหรับสัปดาห์หน้า",
    "ขั้นตอนไหนควรเพิ่มคน",
    "จุดที่ควรปรับปรุงเพื่อลดเวลา",
  ],
};

export function AdminAiAssistant() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("qa");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(aiAdminAsk);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const token = getAdminToken();
    if (!token) {
      toast.error("กรุณาเข้าสู่ระบบแอดมิน");
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { token, mode, messages: next } });
      if (!res.ok) {
        toast.error(res.error);
        setMessages((m) => [...m, { role: "assistant", content: `❌ ${res.error}` }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
        setRemaining(res.remaining);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "เรียก AI ไม่สำเร็จ";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="ผู้ช่วย AI"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-40 flex h-[min(560px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">ผู้ช่วย AI แอดมิน</div>
                <div className="text-[11px] text-muted-foreground">
                  {remaining !== null ? `เหลือ ${remaining} ข้อความวันนี้` : "ถามเรื่องในระบบได้เลย"}
                </div>
              </div>
            </div>
            <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("qa")}
                className={cn(
                  "rounded px-2 py-1 transition",
                  mode === "qa" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                ถาม-ตอบ
              </button>
              <button
                type="button"
                onClick={() => setMode("plan")}
                className={cn(
                  "rounded px-2 py-1 transition",
                  mode === "plan" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                วางแผน
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">ตัวอย่างคำถาม:</div>
                {SUGGESTIONS[mode].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังคิด...
              </div>
            )}
          </div>

          <div className="border-t border-border bg-background p-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="พิมพ์คำถาม..."
                rows={2}
                className="min-h-[44px] resize-none text-sm"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => send()}
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
