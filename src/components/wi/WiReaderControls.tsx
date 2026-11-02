// Employee-side controls for WI pages: language switch and "who is reading".
// Both are per-device preferences (localStorage) — no login on the shop floor.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpenCheck, Check, Loader2, Search, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { flagFor, initialsOf } from "@/lib/utils/i18n";
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
  selectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (reader: WiReader) => void;
  selectedId?: string | null;
}) {
  const [, , t] = useWiLang();
  const [rows, setRows] = useState<EmployeeRow[] | null>(employeeCache);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || employeeCache) return;
    let alive = true;
    setFailed(false);
    supabase
      .from("employees")
      .select("id,name,emp_code,nationality,avatar_url")
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.emp_code ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-3 rounded-3xl p-4 sm:max-w-md">
        <div>
          <DialogTitle className="text-xl">{t("pickName")}</DialogTitle>
          <DialogDescription>{t("pickNameHint")}</DialogDescription>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchName")}
            className="h-12 rounded-xl pl-9 text-base"
          />
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {failed ? (
            <p className="py-8 text-center text-sm text-destructive">{t("retry")}</p>
          ) : !rows ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noEmployee")}</p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick({ id: e.id, name: e.name, nationality: e.nationality });
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left",
                      selectedId === e.id
                        ? "border-[#E32D24] bg-[#E32D24]/5"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      {e.avatar_url ? <AvatarImage src={e.avatar_url} alt={e.name} /> : null}
                      <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                        {initialsOf(e.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-lg">{flagFor(e.nationality)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.name}</span>
                      {e.emp_code && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {e.emp_code}
                        </span>
                      )}
                    </span>
                    {selectedId === e.id && <Check className="h-5 w-5 text-[#E32D24]" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
      <WiEmployeePicker
        open={isOpen}
        onOpenChange={setOpen}
        onPick={setReader}
        selectedId={reader?.id}
      />
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
