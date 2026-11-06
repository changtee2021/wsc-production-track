import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Send, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { releaseTrialJobs } from "@/lib/scan-trial.functions";
import { TRIAL_FLOWS, type TrialFlowId } from "@/lib/scan-trial";

export function OfficeJobRelease({ onClose }: { onClose: () => void }) {
  const release = useServerFn(releaseTrialJobs);
  const [codes, setCodes] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [product, setProduct] = useState<TrialFlowId>("roller");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const add = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setInput("");
    setNote(null);
  };

  const send = async () => {
    if (!codes.length || sending) return;
    setSending(true);
    setNote(null);
    try {
      await release({
        data: {
          jobs: codes.map((jobId) => ({ jobId, product })),
          sentByName: "ออฟฟิศ",
        },
      });
      setNote(`ส่งเข้าสแกน v2 แล้ว ${codes.length} ใบ จากนี้พนักงานใช้สแกน v2`);
      setCodes([]);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "ส่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <AppHeader mark="white">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-11 gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปสแกน
        </Button>
      </AppHeader>
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <h1 className="text-lg font-bold">ส่งออเดอร์เข้าสแกน v2</h1>
        <p className="text-sm text-muted-foreground">
          ออเดอร์ที่ส่งแล้ว พนักงานต้องใช้สแกน v2 ต่อไป ออเดอร์ที่ยังไม่ส่งใช้สแกนเดิมได้ตามปกติ
        </p>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add(input);
            }}
            placeholder="พิมพ์รหัสงาน"
            className="h-11"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-11"
            aria-label="เพิ่มรหัสงาน"
            onClick={() => add(input)}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-2">
          {codes.length === 0 ? (
            <li className="text-sm text-muted-foreground">ยังไม่มีรหัสงานในชุดนี้</li>
          ) : (
            codes.map((code) => (
              <li
                key={code}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border bg-card px-3"
              >
                <span className="truncate text-sm font-semibold">{code}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-11"
                  aria-label="เอาใบนี้ออก"
                  onClick={() => setCodes((prev) => prev.filter((item) => item !== code))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))
          )}
        </ul>
        <div>
          <p className="mb-2 text-sm font-semibold">สินค้าทั้งชุด</p>
          <div className="grid grid-cols-2 gap-2">
            {TRIAL_FLOWS.map((flow) => (
              <Button
                key={flow.id}
                type="button"
                variant="outline"
                className={`min-h-11 ${product === flow.id ? "border-primary bg-primary/10" : ""}`}
                onClick={() => setProduct(flow.id)}
              >
                {flow.label}
              </Button>
            ))}
          </div>
        </div>
        <Button
          type="button"
          className="h-14 w-full rounded-2xl text-base font-bold"
          disabled={sending || codes.length === 0}
          onClick={() => void send()}
        >
          <Send className="mr-2 h-5 w-5" />
          {sending ? "กำลังส่ง" : "ส่งออเดอร์เข้าสแกน v2"}
        </Button>
        {note && <p className="text-sm font-semibold">{note}</p>}
      </main>
    </div>
  );
}
