import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, ScanLine } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export function DeptBadgeGate({
  title,
  subtitle,
  icon,
  busy,
  onCode,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  busy: boolean;
  onCode: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  function submit(raw: string) {
    const next = raw.trim();
    if (!next) {
      toast.error("สแกนบัตรหรือพิมพ์เลขพนักงานก่อน");
      return;
    }
    onCode(next);
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <AppHeader mark="white">
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">หน้าแรก</span>
          </Button>
        </Link>
      </AppHeader>
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg">
          {icon}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6 w-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              const result = await acquireCameraStream("environment");
              if ("errorInfo" in result) {
                toast.error(
                  result.errorInfo.hint
                    ? `${result.errorInfo.message} — ${result.errorInfo.hint}`
                    : result.errorInfo.message,
                );
                return;
              }
              setScannerStream(result.stream);
            }}
            className="h-12 w-full gap-2 text-base font-semibold"
          >
            <ScanLine className="h-5 w-5" /> สแกนบัตรพนักงาน
          </Button>
          <div className="mt-3 flex gap-2">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit(code);
              }}
              placeholder="หรือพิมพ์เลขพนักงาน"
              inputMode="numeric"
              className="h-12 text-base"
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              aria-label="ยืนยันเลขพนักงาน"
              onClick={() => submit(code)}
              className="h-12 w-12 shrink-0"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </main>
      <QrScannerDialog
        open={scannerStream !== null}
        onOpenChange={(open) => {
          if (!open) setScannerStream(null);
        }}
        onScanned={(text) => {
          setScannerStream(null);
          setCode(text.trim());
          submit(text);
        }}
        initialStream={scannerStream}
      />
    </div>
  );
}
