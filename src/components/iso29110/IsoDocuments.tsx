import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ISO_BASELINE, ISO_DOC_TABS, findPackIssues, type IsoBlock } from "@/lib/iso29110/pack";

export function IsoDocuments() {
  const [tab, setTab] = useState(ISO_DOC_TABS[0].id);
  const current = ISO_DOC_TABS.find((item) => item.id === tab) ?? ISO_DOC_TABS[0];
  const issues = findPackIssues();

  return (
    <div className="iso-print">
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap gap-2" role="group" aria-label="หมวดเอกสาร">
        {ISO_DOC_TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={item.id === current.id ? "default" : "outline"}
            className="min-h-11 px-3 sm:min-h-9"
            aria-pressed={item.id === current.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-3 sm:min-h-9"
          onClick={() => window.print()}
        >
          พิมพ์แท็บนี้
        </Button>
      </div>

      <p
        className={`mt-4 rounded-xl border px-3 py-2 text-sm ${issues.length === 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"}`}
      >
        {issues.length === 0
          ? "ความสอดคล้องภายในชุดเอกสารผ่าน: ความต้องการทุกรายการมีแบบและมีกรณีทดสอบ ช่องลงนามยังว่างตามจริง"
          : `ความสอดคล้องภายในยังไม่ผ่าน: ${issues.join(" · ")}`}
      </p>

      <div className="mt-4 space-y-4">
        {current.docs.map((doc) => (
          <article
            key={doc.code}
            className="rounded-2xl border bg-white/80 p-4 dark:bg-zinc-900/60"
          >
            <header className="border-b pb-3">
              <p className="text-xs text-muted-foreground">
                {doc.code} · รุ่น {ISO_BASELINE.version} · {ISO_BASELINE.date}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{doc.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">สถานะ: {doc.status}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ISO_BASELINE.project} · {ISO_BASELINE.repo} · {ISO_BASELINE.schema}
              </p>
            </header>
            <div className="mt-3 space-y-3">
              {doc.blocks.map((block, index) => (
                <BlockView key={`${doc.code}-${index}`} block={block} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BlockView({ block }: { block: IsoBlock }) {
  if (block.type === "p") {
    return <p className="text-sm leading-relaxed">{block.text}</p>;
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header} className="border-b px-2 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="align-top">
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className="border-b px-2 py-2">
                  {cell === "" ? "ว่าง" : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
