// Employee-side controls for WI pages: language switch and "who is reading".
// Both are per-device preferences (localStorage) — no login on the shop floor.
import { useEffect, useState, type ReactNode } from "react";
import { BookOpenCheck, Loader2, ScanLine, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { cn } from "@/lib/utils";
import { flagFor } from "@/lib/utils/i18n";
import { WI_LANGS } from "@/lib/wi/wi-schema";
import { WI_LANG_LABEL, useWiLang, useWiReader, type WiReader } from "@/lib/wi/wi-i18n";

export function WiLangSwitch({ className, dark }: { className?: string; dark?: boolean }) {
  const [lang, setLang, t] = useWiLang();
  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className={cn("inline-flex rounded-xl p-1", dark ? "bg-white/15" : "bg-muted", className)}
    >
      {WI_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={cn(
            "min-h-10 min-w-12 whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold transition-colors",
            lang === l
              ? dark
                ? "bg-white text-slate-900"
                : "bg-background text-foreground shadow-sm"
              : dark
                ? "text-white/80"
                : "text-muted-foreground",
          )}
        >
          {WI_LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

type EmployeeRow = {
  id: string;
  name: string;
  emp_code: string | null;
  nationality: string | null;
  avatar_url: string | null;
};

let employeeCache: EmployeeRow[] | null = null;

export function WiEmployeePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (reader: WiReader) => void;
}) {
  const [, , t] = useWiLang();
  const [rows, setRows] = useState<EmployeeRow[] | null>(employeeCache);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    if (employeeCache) return;
    let alive = true;
    setFailed(false);
    supabase
      .from("employees")
      .select("id,name,emp_code,nationality,avatar_url")
      .eq("active", true)
      .order("name")
      .then(({ data, error: loadError }) => {
        if (!alive) return;
        if (loadError) {
          setFailed(true);
          return;
        }
        employeeCache = (data ?? []) as EmployeeRow[];
        setRows(employeeCache);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  function applyCode(raw: string) {
    const next = raw.trim();
    if (!next) {
      setError(t("enterCode"));
      return;
    }
    if (failed) {
      setError(t("retry"));
      return;
    }
    const list = employeeCache ?? rows;
    if (!list) {
      setError(t("loading"));
      return;
    }
    const person = list.find((row) => (row.emp_code ?? "").trim() === next);
    if (!person) {
      setError(t("noEmployee"));
      return;
    }
    onPick({ id: person.id, name: person.name, nationality: person.nationality });
    setCode("");
    setError(null);
    onOpenChange(false);
  }

  async function openScanner() {
    const got = await acquireCameraStream();
    if ("errorInfo" in got) {
      toast.error(t("cameraFailed"));
      return;
    }
    setScannerStream(got.stream);
    setScanning(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88dvh] flex-col gap-3 rounded-3xl p-4 sm:max-w-md">
          <div>
            <DialogTitle className="text-xl">{t("pickName")}</DialogTitle>
            <DialogDescription>{t("pickNameHint")}</DialogDescription>
          </div>
          <Button
            type="button"
            className="h-12 gap-2 rounded-xl bg-[#E32D24] text-base text-white hover:bg-[#c9261e]"
            onClick={() => void openScanner()}
          >
            <ScanLine className="h-5 w-5" /> {t("pickName")}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              applyCode(code);
            }}
          >
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("searchName")}
              className="h-12 min-w-0 flex-1 rounded-xl text-base"
            />
            <Button type="submit" variant="outline" className="h-12 rounded-xl px-4">
              {rows ? t("confirmCode") : <Loader2 className="h-5 w-5 animate-spin" />}
            </Button>
          </form>
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
      <QrScannerDialog
        open={scanning}
        initialStream={scannerStream}
        onOpenChange={(next) => {
          setScanning(next);
          if (!next) setScannerStream(null);
        }}
        onScanned={(text) => {
          setScanning(false);
          setScannerStream(null);
          applyCode(text);
        }}
      />
    </>
  );
}

/** Chip showing who is reading on this device, with a picker to change it. */
export function WiReaderChip({
  dark,
  open,
  onOpenChange,
}: {
  dark?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [reader, setReader] = useWiReader();
  const [, , t] = useWiLang();
  const [innerOpen, setInnerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  if (!mounted) {
    return (
      <span
        aria-hidden
        className={cn("inline-block h-11 w-32 rounded-xl", dark ? "bg-white/15" : "bg-muted")}
      />
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold",
          dark
            ? reader
              ? "bg-white/15 text-white"
              : "bg-white text-slate-900"
            : reader
              ? "bg-muted text-foreground"
              : "bg-[#E32D24] text-white",
        )}
      >
        <UserRound className="h-4 w-4 shrink-0" />
        {reader ? (
          <>
            <span className="min-w-0 truncate">
              {flagFor(reader.nationality)} {reader.name}
            </span>
            <span
              className={cn(
                "hidden shrink-0 text-xs font-normal sm:inline",
                dark ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {t("change")}
            </span>
          </>
        ) : (
          <span>{t("whoAreYou")}</span>
        )}
      </button>
      <WiEmployeePicker open={isOpen} onOpenChange={setOpen} onPick={setReader} />
    </>
  );
}

/** Sticky header for employee WI pages: back · title + language · (extra) + reader. */
export function WiManualHeader({
  back,
  extra,
  pickerOpen,
  onPickerOpenChange,
}: {
  back: ReactNode;
  extra?: ReactNode;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const [, , t] = useWiLang();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2">
          <div className="shrink-0">{back}</div>
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="hidden min-w-0 items-center gap-1.5 text-sm font-semibold md:flex">
              <BookOpenCheck className="h-4 w-4 shrink-0 text-[#E32D24]" />
              <span className="truncate">{t("appTitle")}</span>
            </span>
            <WiLangSwitch />
          </div>
          <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
            {extra}
            <WiReaderChip open={pickerOpen} onOpenChange={onPickerOpenChange} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl px-3 pt-3 sm:hidden">
        <WiLangSwitch className="w-full [&>button]:flex-1" />
      </div>
    </>
  );
}

/** Blocks WI content until this device has picked who is reading. */
export function WiReaderGate({ children }: { children: ReactNode }) {
  const [reader, setReader] = useWiReader();
  const [, , t] = useWiLang();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !reader) setOpen(true);
  }, [mounted, reader]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
      </div>
    );
  }
  if (reader) return <>{children}</>;

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-sm">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E32D24]/10 text-[#E32D24]">
        <UserRound className="h-8 w-8" />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t("pickNameFirst")}</h1>
        <p className="text-sm text-muted-foreground">{t("pickNameFirstHint")}</p>
      </div>
      <Button
        className="h-12 gap-2 rounded-xl bg-[#E32D24] px-6 text-base text-white hover:bg-[#c9261e]"
        onClick={() => setOpen(true)}
      >
        <UserRound className="h-5 w-5" /> {t("pickName")}
      </Button>
      <WiEmployeePicker open={open} onOpenChange={setOpen} onPick={setReader} />
    </div>
  );
}
