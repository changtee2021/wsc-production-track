import { Button } from "@/components/ui/button";
import { ISO_AUDIT } from "@/lib/iso29110/audit";

const LEVEL_CLASS: Record<string, string> = {
  หลัก: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300",
  รอง: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
};

const RATING_CLASS: Record<string, string> = {
  N: "text-red-800 dark:text-red-300",
  P: "text-amber-900 dark:text-amber-200",
  L: "text-emerald-800 dark:text-emerald-300",
  F: "text-emerald-800 dark:text-emerald-300",
};

export function IsoAuditReport() {
  return (
    <article className="iso-print space-y-6">
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
          {ISO_AUDIT.id}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">{ISO_AUDIT.verdict}</h2>
        <p className="mt-2 text-sm leading-relaxed">{ISO_AUDIT.verdictDetail}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {ISO_AUDIT.kind} · {ISO_AUDIT.standard} · {ISO_AUDIT.date}
        </p>
      </div>

      <div className="no-print">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-3 sm:min-h-9"
          onClick={() => window.print()}
        >
          พิมพ์รายงานนี้
        </Button>
      </div>

      <section>
        <h2 className="text-lg font-semibold">ขั้นที่ 1 ขอบเขตที่เปิดตรวจ</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <tbody>
              {ISO_AUDIT.scope.map(([label, value]) => (
                <tr key={label} className="border-t first:border-t-0">
                  <th className="w-40 px-3 py-2 align-top font-medium">{label}</th>
                  <td className="px-3 py-2">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          {ISO_AUDIT.limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">ขั้นตอนที่ทำให้ครบ</h2>
        <ol className="mt-2 space-y-2">
          {ISO_AUDIT.steps.map((step) => (
            <li key={step.id} className="rounded-xl border px-3 py-2 text-sm">
              <span className="font-semibold">
                {step.id}. {step.title}
              </span>
              <span className="mt-1 block text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold">ขั้นที่ 1 ผลตรวจเอกสาร</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">รหัส</th>
                <th className="px-3 py-2 font-medium">ที่พบ</th>
                <th className="px-3 py-2 font-medium">ที่ยังใช้ยื่นไม่ได้</th>
              </tr>
            </thead>
            <tbody>
              {ISO_AUDIT.stage1.map(([code, found, gap]) => (
                <tr key={code} className="border-t">
                  <td className="px-3 py-2 align-top font-medium whitespace-nowrap">{code}</td>
                  <td className="px-3 py-2 align-top">{found}</td>
                  <td className="px-3 py-2 align-top">{gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">ขั้นที่ 2 ผลสุ่มการทำจริง</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">ตัวอย่าง</th>
                <th className="px-3 py-2 font-medium">หลักฐาน</th>
                <th className="px-3 py-2 font-medium">ช่องที่เหลือ</th>
              </tr>
            </thead>
            <tbody>
              {ISO_AUDIT.stage2.map(([sample, evidence, gap]) => (
                <tr key={sample} className="border-t">
                  <td className="px-3 py-2 align-top font-medium">{sample}</td>
                  <td className="px-3 py-2 align-top">{evidence}</td>
                  <td className="px-3 py-2 align-top">{gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">คะแนนกิจกรรม</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          N ไม่บรรลุ · P บรรลุบางส่วน · L บรรลุเป็นส่วนใหญ่ · F บรรลุครบ
        </p>
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">กิจกรรม</th>
                <th className="px-3 py-2 font-medium">คะแนน</th>
                <th className="px-3 py-2 font-medium">เหตุผล</th>
              </tr>
            </thead>
            <tbody>
              {ISO_AUDIT.ratings.map(([activity, rating, reason]) => (
                <tr key={activity} className="border-t">
                  <td className="px-3 py-2 align-top font-medium">{activity}</td>
                  <td className={`px-3 py-2 align-top font-semibold ${RATING_CLASS[rating] ?? ""}`}>
                    {rating}
                  </td>
                  <td className="px-3 py-2 align-top">{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ใบไม่สอดคล้อง</h2>
        {ISO_AUDIT.findings.map((finding) => (
          <article key={finding.id} className="rounded-xl border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{finding.id}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_CLASS[finding.level] ?? ""}`}
              >
                ข้อ{finding.level}
              </span>
              <span className="text-xs text-muted-foreground">{finding.clause}</span>
            </div>
            <h3 className="mt-2 font-semibold">{finding.title}</h3>
            <p className="mt-1">
              <span className="font-medium">หลักฐาน </span>
              {finding.evidence}
            </p>
            <p className="mt-1">
              <span className="font-medium">ผลต่อการยื่น </span>
              {finding.effect}
            </p>
            <p className="mt-1">
              <span className="font-medium">วิธีปิด </span>
              {finding.close}
            </p>
          </article>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold">จุดที่ใช้เป็นหลักฐานได้</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {ISO_AUDIT.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">เงื่อนไขก่อนยื่นซ้ำ</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          {ISO_AUDIT.beforeSubmit.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}
