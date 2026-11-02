// Loads the live version of one WI for an employee, logs that they opened it,
// and records "read and understood". Shared by /manual/$code and the scan sheet.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { wiPublicGet, wiPublicRecordRead } from "@/lib/features/wi.functions";
import { WiViewer, type WiViewerReadState } from "@/components/wi/WiViewer";
import type { WiLang } from "@/lib/wi/wi-schema";
import { wiT } from "@/lib/wi/wi-i18n";

type Result = Awaited<ReturnType<typeof wiPublicGet>>;

export function WiLiveManual({
  code,
  employeeId,
  lang,
  onNeedEmployee,
  onReadChange,
}: {
  code: string;
  employeeId: string | null;
  lang: WiLang;
  onNeedEmployee: () => void;
  onReadChange?: (state: WiViewerReadState) => void;
}) {
  const getFn = useServerFn(wiPublicGet);
  const recordFn = useServerFn(wiPublicRecordRead);
  const t = wiT(lang);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [readState, setReadState] = useState<WiViewerReadState | null>(null);
  const [acking, setAcking] = useState(false);
  const logged = useRef<string | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;
  const onReadChangeRef = useRef(onReadChange);
  onReadChangeRef.current = onReadChange;

  useEffect(() => {
    let alive = true;
    setError(null);
    getFn({ data: { code, employee_id: employeeId } })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setReadState(r.found ? r.my_read : null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : t("notAvailable")));
    return () => {
      alive = false;
    };
    // t only feeds the fallback message; reloading on language change is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, employeeId, getFn, reload]);

  // Log one view per (manual version, employee) while the page is open.
  useEffect(() => {
    if (!result?.found || !employeeId) return;
    const key = `${code}:${result.version}:${employeeId}`;
    if (logged.current === key) return;
    logged.current = key;
    recordFn({ data: { code, employee_id: employeeId, acknowledge: false, lang: langRef.current } })
      .then((r) =>
        setReadState((prev) =>
          prev?.status === "read" || prev?.status === "outdated" ? prev : r.my_read,
        ),
      )
      .catch(() => {
        logged.current = null;
      });
  }, [result, employeeId, code, recordFn]);

  const acknowledge = async () => {
    if (!employeeId) {
      toast.info(t("pickNameToConfirm"));
      onNeedEmployee();
      return;
    }
    setAcking(true);
    try {
      const r = await recordFn({
        data: { code, employee_id: employeeId, acknowledge: true, lang },
      });
      setReadState(r.my_read);
      onReadChangeRef.current?.(r.my_read);
      toast.success(t("savedRead"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("retry"));
    } finally {
      setAcking(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" className="h-11" onClick={() => setReload((n) => n + 1)}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
      </div>
    );
  }
  if (!result.found) {
    return (
      <div className="space-y-2 rounded-3xl border border-dashed p-8 text-center">
        <BookX className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("notFound")}</h2>
        <p className="text-sm text-muted-foreground">{t("notFoundHint")}</p>
      </div>
    );
  }
  return (
    <WiViewer
      key={code}
      snapshot={result.snapshot}
      mediaUrls={result.mediaUrls}
      versionLabel={result.version}
      publishedAt={result.published_at}
      lang={lang}
      readState={readState}
      onAcknowledge={acknowledge}
      acknowledging={acking}
    />
  );
}
