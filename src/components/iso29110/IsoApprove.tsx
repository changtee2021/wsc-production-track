import { Button } from "@/components/ui/button";
import {
  APPROVE_SHEETS,
  CONSULTANT_DONE,
  CONSULTANT_LEFT,
  buildSignPackHtml,
} from "@/lib/iso29110/sign-pack";

function downloadPack() {
  const blob = new Blob([buildSignPackHtml()], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "WSC-ISO29110-ใบอนุมัติ-1.0.html";
  link.click();
  URL.revokeObjectURL(url);
}

export function IsoApprove() {
  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" className="min-h-11 px-3 sm:min-h-9" onClick={downloadPack}>
          ดาวน์โหลดใบอนุมัติ
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-3 sm:min-h-9"
          onClick={() => window.print()}
        >
          พิมพ์ใบนี้
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        ติ๊กและเซ็นบนกระดาษหลังพิมพ์หรือเปิดไฟล์ที่ดาวน์โหลด หน้านี้ยังไม่เก็บลายเซ็น
        ที่ปรึกษาไม่ได้ติ๊กแทน
      </p>
      {APPROVE_SHEETS.map((sheet) => (
        <article key={sheet.id} className="rounded-2xl border bg-white/80 p-4 dark:bg-zinc-900/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ให้คนนี้ติ๊ก
          </p>
          <h2 className="mt-1 text-xl font-bold">{sheet.who}</h2>
          <p className="mt-1 text-sm leading-relaxed">{sheet.meaning}</p>
          <ul className="mt-3 space-y-2">
            {sheet.checks.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                <span
                  aria-hidden
                  className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded-sm border-2 border-foreground"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-sm">
            <p className="font-semibold">เซ็นใบนี้แล้วยังไม่ปิด</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {sheet.stillOpen.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-sm">ชื่อ ____________ วันที่ ____________ ลายเซ็น ____________</p>
        </article>
      ))}
      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border p-4 text-sm">
          <h2 className="font-semibold">ที่ปรึกษาทำแล้ว</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            {CONSULTANT_DONE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border p-4 text-sm">
          <h2 className="font-semibold">ยังไม่ให้ติ๊กผ่าน</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            {CONSULTANT_LEFT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
