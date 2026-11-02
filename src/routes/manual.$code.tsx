// Employee-facing, read-only Work Instruction (published snapshot only).
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WiLiveManual } from "@/components/wi/WiLiveManual";
import { WiManualHeader, WiReaderGate } from "@/components/wi/WiReaderControls";
import { useWiLang, useWiReader } from "@/lib/wi/wi-i18n";

export const Route = createFileRoute("/manual/$code")({
  head: () => ({
    meta: [
      { title: "คู่มือปฏิบัติงาน — WSC ProductionTrack" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManualPage,
});

function ManualPage() {
  const { code } = Route.useParams();
  const router = useRouter();
  const [lang, , t] = useWiLang();
  const [reader] = useWiReader();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <main className="min-h-[100dvh] bg-muted/30">
      <WiManualHeader
        pickerOpen={pickerOpen}
        onPickerOpenChange={setPickerOpen}
        back={
          <Button
            variant="ghost"
            className="h-11 gap-1 px-2"
            onClick={() =>
              window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" })
            }
          >
            <ArrowLeft className="h-5 w-5" /> {t("back")}
          </Button>
        }
        extra={
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={t("print")}
          >
            <Link to="/manual/$code/print" params={{ code }}>
              <Printer className="h-5 w-5" />
            </Link>
          </Button>
        }
      />
      <section className="mx-auto max-w-5xl px-3 py-4 pb-16 sm:px-4">
        <WiReaderGate>
          <WiLiveManual
            code={code}
            employeeId={reader?.id ?? null}
            lang={lang}
            onNeedEmployee={() => setPickerOpen(true)}
          />
        </WiReaderGate>
      </section>
    </main>
  );
}
