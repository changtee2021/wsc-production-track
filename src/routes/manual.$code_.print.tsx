// Printable Work Instruction for posting at the workstation (published snapshot only).
// Paper copies go stale, so every sheet carries the version + a QR back to the live manual.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import QRCode from "qrcode";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { wiPublicGet } from "@/lib/features/wi.functions";
import { clientAppPublicPath } from "@/lib/app-public-url";
import { WI_ACCENT_BTN } from "@/lib/wi/wi-client";
import type { WiCheckpoint, WiMedia, WiSnapshot, WiStepContent } from "@/lib/wi/wi-schema";

const LAYOUTS = ["detail", "poster"] as const;
type Layout = (typeof LAYOUTS)[number];

export const Route = createFileRoute("/manual/$code_/print")({
  validateSearch: zodValidator(
    z.object({
      layout: fallback(z.enum(LAYOUTS), "detail").default("detail"),
      images: fallback(z.boolean(), true).default(true),
      large: fallback(z.boolean(), false).default(false),
    }),
  ),
  head: () => ({
    meta: [
      { title: "พิมพ์คู่มือปฏิบัติงาน — WSC ProductionTrack" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WiPrintPage,
});

type Result = Awaited<ReturnType<typeof wiPublicGet>>;
type Found = Extract<Result, { found: true }>;

function thaiDate(iso: string | Date) {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

function rangeText(c: WiCheckpoint) {
  if (c.min != null && c.max != null) return `${c.min}–${c.max}`;
  if (c.min != null) return `≥ ${c.min}`;
  if (c.max != null) return `≤ ${c.max}`;
  return "";
}

function stepImages(step: WiStepContent, urls: Record<string, string>, limit: number) {
  return step.media
    .filter(
      (m): m is WiMedia & { path: string } => m.type === "image" && !!m.path && !!urls[m.path],
    )
    .slice(0, limit);
}

function Box() {
  return <span className="wp-box" aria-hidden />;
}

function CheckpointLine({ c }: { c: WiCheckpoint }) {
  const range = rangeText(c);
  return (
    <li className="wp-check">
      <span className="wp-check-label">
        {c.label}
        {c.required && <span className="wp-req"> *</span>}
      </span>
      <span className="wp-check-field">
        {c.type === "pass_fail" && (
          <>
            <Box /> ผ่าน <Box /> ไม่ผ่าน
          </>
        )}
        {c.type === "checkbox" && (
          <>
            <Box /> เรียบร้อย
          </>
        )}
        {c.type === "numeric" && (
          <>
            วัดได้ <span className="wp-blank" /> {c.unit}
            {range && (
              <span className="wp-muted">
                {" "}
                (เกณฑ์ {range}
                {c.unit ? ` ${c.unit}` : ""})
              </span>
            )}
          </>
        )}
        {c.type === "text" && <span className="wp-blank wp-blank-long" />}
        {c.type === "photo" && <span className="wp-muted">ถ่ายรูปบันทึกในระบบ</span>}
      </span>
      {c.criteria && <span className="wp-criteria">เกณฑ์: {c.criteria}</span>}
    </li>
  );
}

function StepNotes({ step }: { step: WiStepContent }) {
  return (
    <>
      {step.warning && (
        <p className="wp-warn">
          <strong>ระวัง:</strong> {step.warning}
        </p>
      )}
      {step.instructions && <p className="wp-pre">{step.instructions}</p>}
      {step.note && (
        <p className="wp-note">
          <strong>หมายเหตุ:</strong> {step.note}
        </p>
      )}
      {step.expected_result && (
        <p className="wp-expect">
          <strong>ผลลัพธ์ที่ต้องได้:</strong> {step.expected_result}
        </p>
      )}
    </>
  );
}

function SheetHeader({ r, qr, compact }: { r: Found; qr: string; compact?: boolean }) {
  const s = r.snapshot;
  return (
    <div className={cn("wp-head", compact && "wp-head-compact")}>
      <div className="wp-head-brand">
        <div className="wp-kicker">WSC · วิธีปฏิบัติงาน (Work Instruction)</div>
        <div className="wp-title">{s.title}</div>
        {!compact && s.description && <div className="wp-desc">{s.description}</div>}
      </div>
      <table className="wp-ctrl">
        <tbody>
          <tr>
            <th>รหัส</th>
            <td className="wp-mono">{s.wi_code}</td>
          </tr>
          <tr>
            <th>ฉบับ</th>
            <td className="wp-mono">{r.version}</td>
          </tr>
          <tr>
            <th>มีผล</th>
            <td>{thaiDate(r.published_at)}</td>
          </tr>
          {s.category_name && (
            <tr>
              <th>หมวด</th>
              <td>{s.category_name}</td>
            </tr>
          )}
        </tbody>
      </table>
      {qr && (
        <div className="wp-qr">
          <img src={qr} alt={`QR ${s.wi_code}`} />
          <span>สแกนดูฉบับล่าสุด / วิดีโอ</span>
        </div>
      )}
    </div>
  );
}

function SheetFooter({ r, printedAt }: { r: Found; printedAt: Date }) {
  return (
    <div className="wp-foot">
      <span>
        เอกสารควบคุม — ใช้ได้เมื่อตรงกับ <strong>{r.version}</strong> ในระบบเท่านั้น สแกน QR
        เพื่อตรวจฉบับล่าสุด
      </span>
      <span>
        {r.snapshot.wi_code} {r.version} · พิมพ์ {thaiDate(printedAt)}
      </span>
    </div>
  );
}

function InfoStrip({ s }: { s: WiSnapshot }) {
  const items = [
    s.owner_name ? ["ผู้รับผิดชอบ", s.owner_name] : null,
    s.est_minutes ? ["เวลาโดยประมาณ", `${s.est_minutes} นาที`] : null,
    ["จำนวนขั้นตอน", `${s.steps.length} ขั้น`],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="wp-info">
      {items.map(([k, v]) => (
        <span key={k}>
          <span className="wp-muted">{k}:</span> <strong>{v}</strong>
        </span>
      ))}
    </div>
  );
}

function SafetyBlocks({ s }: { s: WiSnapshot }) {
  if (!s.safety_notes && !s.equipment) return null;
  return (
    <div className={cn("wp-boxes", s.safety_notes && s.equipment && "wp-boxes-2")}>
      {s.safety_notes && (
        <div className="wp-safety">
          <div className="wp-box-title">ข้อควรระวังด้านความปลอดภัย</div>
          <p className="wp-pre">{s.safety_notes}</p>
        </div>
      )}
      {s.equipment && (
        <div className="wp-equip">
          <div className="wp-box-title">อุปกรณ์ / วัสดุที่ต้องใช้</div>
          <p className="wp-pre">{s.equipment}</p>
        </div>
      )}
    </div>
  );
}

function SignOff({ r }: { r: Found }) {
  return (
    <div className="wp-sign">
      <div>
        <span className="wp-muted">จัดทำโดย</span>
        <strong>{r.editor_name || " "}</strong>
      </div>
      <div>
        <span className="wp-muted">อนุมัติโดย</span>
        <strong>{r.reviewer_name || " "}</strong>
      </div>
      <div>
        <span className="wp-muted">วันที่มีผล</span>
        <strong>{thaiDate(r.published_at)}</strong>
      </div>
      <div>
        <span className="wp-muted">ผู้ติดประกาศ / วันที่</span>
        <span className="wp-blank wp-blank-long" />
      </div>
    </div>
  );
}

function DetailSheet({
  r,
  qr,
  showImages,
  printedAt,
}: {
  r: Found;
  qr: string;
  showImages: boolean;
  printedAt: Date;
}) {
  const s = r.snapshot;
  return (
    <table className="wp-sheet">
      <thead>
        <tr>
          <td>
            <SheetHeader r={r} qr={qr} />
          </td>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td>
            <SheetFooter r={r} printedAt={printedAt} />
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td>
            <InfoStrip s={s} />
            <SafetyBlocks s={s} />
            <ol className="wp-steps">
              {s.steps.map((step, i) => {
                const imgs = showImages ? stepImages(step, r.mediaUrls, 2) : [];
                const videos = step.media.filter((m) => m.type !== "image").length;
                return (
                  <li key={step.id} className={cn("wp-step", imgs.length > 0 && "wp-step-img")}>
                    <div className="wp-num">{i + 1}</div>
                    <div className="wp-step-body">
                      <div className="wp-step-title">{step.title || `ขั้นตอนที่ ${i + 1}`}</div>
                      <StepNotes step={step} />
                      {step.checkpoints.length > 0 && (
                        <div className="wp-checks">
                          <div className="wp-checks-title">จุดตรวจคุณภาพ</div>
                          <ul>
                            {step.checkpoints.map((c) => (
                              <CheckpointLine key={c.id} c={c} />
                            ))}
                          </ul>
                        </div>
                      )}
                      {videos > 0 && (
                        <p className="wp-muted wp-small">
                          มีวิดีโอ/ลิงก์ประกอบ {videos} รายการ — สแกน QR ด้านบนเพื่อดู
                        </p>
                      )}
                    </div>
                    {imgs.length > 0 && (
                      <div className="wp-step-media">
                        {imgs.map((m) => (
                          <figure key={m.id}>
                            <img src={r.mediaUrls[m.path]} alt={m.caption || step.title} />
                            {m.caption && <figcaption>{m.caption}</figcaption>}
                          </figure>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <SignOff r={r} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function PosterSheet({
  r,
  qr,
  showImages,
  printedAt,
}: {
  r: Found;
  qr: string;
  showImages: boolean;
  printedAt: Date;
}) {
  const s = r.snapshot;
  const cols = s.steps.length <= 2 ? 2 : s.steps.length === 4 ? 2 : 3;
  return (
    <table className="wp-sheet wp-poster">
      <thead>
        <tr>
          <td>
            <SheetHeader r={r} qr={qr} compact />
          </td>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td>
            <SheetFooter r={r} printedAt={printedAt} />
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td>
            {s.safety_notes && (
              <div className="wp-banner">
                <strong>ความปลอดภัย:</strong> {s.safety_notes}
              </div>
            )}
            <ol className="wp-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {s.steps.map((step, i) => {
                const img = showImages ? stepImages(step, r.mediaUrls, 1)[0] : undefined;
                return (
                  <li key={step.id} className="wp-card">
                    <div className="wp-card-head">
                      <span className="wp-num wp-num-lg">{i + 1}</span>
                      <span className="wp-card-title">{step.title || `ขั้นตอนที่ ${i + 1}`}</span>
                    </div>
                    {img && (
                      <img
                        className="wp-card-img"
                        src={r.mediaUrls[img.path]}
                        alt={img.caption || step.title}
                      />
                    )}
                    <StepNotes step={step} />
                    {step.checkpoints.length > 0 && (
                      <p className="wp-card-checks">
                        <strong>ตรวจ:</strong>{" "}
                        {step.checkpoints
                          .map((c) =>
                            rangeText(c) ? `${c.label} (${rangeText(c)} ${c.unit})` : c.label,
                          )
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const PRINT_CSS = `
  .wp-root { --wp-red: #E32D24; --wp-ink: #111; --wp-mute: #555; --wp-line: #bbb;
    color: var(--wp-ink); font-size: 10.5pt; line-height: 1.45; }
  .wp-root.wp-large { font-size: 13pt; }
  .wp-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  .wp-paper { background: #fff; margin: 0 auto 24px; padding: 12mm; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
  .wp-paper.wp-portrait { width: 210mm; min-height: 297mm; }
  .wp-paper.wp-landscape { width: 297mm; min-height: 210mm; padding: 8mm; }
  .wp-sheet { width: 100%; border-collapse: collapse; }
  .wp-sheet > thead td, .wp-sheet > tfoot td, .wp-sheet > tbody td { padding: 0; vertical-align: top; }
  .wp-head { display: grid; grid-template-columns: 1fr auto auto; gap: 4mm; align-items: start;
    border-bottom: 2.5pt solid var(--wp-red); padding-bottom: 3mm; margin-bottom: 4mm; }
  .wp-kicker { font-size: .75em; letter-spacing: .04em; color: var(--wp-red); font-weight: 700; }
  .wp-title { font-size: 1.75em; font-weight: 800; line-height: 1.2; }
  .wp-head-compact .wp-title { font-size: 1.55em; }
  .wp-desc { color: var(--wp-mute); margin-top: 1mm; }
  .wp-ctrl { border-collapse: collapse; font-size: .82em; }
  .wp-ctrl th, .wp-ctrl td { border: .6pt solid var(--wp-line); padding: .8mm 2mm; text-align: left; white-space: nowrap; }
  .wp-ctrl th { background: #f3f3f3; font-weight: 600; }
  .wp-mono { font-family: ui-monospace, Menlo, monospace; font-weight: 700; }
  .wp-qr { display: flex; flex-direction: column; align-items: center; width: 24mm; }
  .wp-qr img { width: 24mm; height: 24mm; }
  .wp-qr span { font-size: .62em; text-align: center; color: var(--wp-mute); line-height: 1.2; }
  .wp-foot { display: flex; justify-content: space-between; gap: 4mm; border-top: .6pt solid var(--wp-line);
    margin-top: 4mm; padding-top: 1.5mm; font-size: .72em; color: var(--wp-mute); }
  .wp-info { display: flex; flex-wrap: wrap; gap: 2mm 6mm; margin-bottom: 3mm; }
  .wp-muted { color: var(--wp-mute); }
  .wp-small { font-size: .85em; }
  .wp-pre { white-space: pre-wrap; margin: 0 0 1.5mm; }
  .wp-boxes { display: grid; gap: 3mm; margin-bottom: 4mm; }
  .wp-boxes-2 { grid-template-columns: 1fr 1fr; }
  .wp-safety, .wp-equip { border-radius: 2mm; padding: 2.5mm 3mm; break-inside: avoid; }
  .wp-safety { border: 1.2pt solid var(--wp-red); background: #fdeceb; }
  .wp-equip { border: .8pt solid var(--wp-line); background: #f7f7f7; }
  .wp-box-title { font-weight: 700; margin-bottom: 1mm; }
  .wp-safety .wp-box-title { color: var(--wp-red); }
  .wp-steps { list-style: none; margin: 0; padding: 0; }
  .wp-step { display: grid; grid-template-columns: 10mm 1fr; gap: 3mm; padding: 3mm 0;
    border-bottom: .6pt solid var(--wp-line); break-inside: avoid; page-break-inside: avoid; }
  .wp-step-img { grid-template-columns: 10mm 1fr 58mm; }
  .wp-num { display: inline-flex; align-items: center; justify-content: center; width: 9mm; height: 9mm;
    border-radius: 50%; background: var(--wp-ink); color: #fff; font-weight: 800; font-size: 1.1em; }
  .wp-num-lg { width: 12mm; height: 12mm; font-size: 1.5em; flex-shrink: 0; }
  .wp-step-title { font-weight: 800; font-size: 1.15em; margin-bottom: 1mm; }
  .wp-warn { border-left: 2pt solid var(--wp-red); background: #fdeceb; padding: 1mm 2mm; margin: 0 0 1.5mm; }
  .wp-warn strong { color: var(--wp-red); }
  .wp-note { margin: 0 0 1.5mm; }
  .wp-expect { border-left: 2pt solid #16a34a; background: #ecfdf3; padding: 1mm 2mm; margin: 0 0 1.5mm; }
  .wp-checks { border: .6pt dashed var(--wp-line); border-radius: 1.5mm; padding: 1.5mm 2mm; margin-top: 1.5mm; }
  .wp-checks-title { font-weight: 700; font-size: .9em; margin-bottom: .5mm; }
  .wp-checks ul { list-style: none; margin: 0; padding: 0; }
  .wp-check { display: flex; flex-wrap: wrap; align-items: center; gap: 1mm 4mm; padding: .8mm 0; }
  .wp-check-label { font-weight: 600; min-width: 35%; }
  .wp-check-field { display: inline-flex; align-items: center; gap: 1.5mm; }
  .wp-criteria { width: 100%; font-size: .85em; color: var(--wp-mute); }
  .wp-req { color: var(--wp-red); }
  .wp-box { display: inline-block; width: 4mm; height: 4mm; border: .9pt solid var(--wp-ink); border-radius: .6mm; }
  .wp-blank { display: inline-block; width: 18mm; border-bottom: .8pt solid var(--wp-ink); height: 1em; }
  .wp-blank-long { width: 45mm; }
  .wp-step-media { display: flex; flex-direction: column; gap: 2mm; }
  .wp-step-media figure { margin: 0; }
  .wp-step-media img { width: 100%; max-height: 48mm; object-fit: contain; border: .6pt solid var(--wp-line);
    border-radius: 1.5mm; background: #fafafa; }
  .wp-step-media figcaption { font-size: .78em; color: var(--wp-mute); text-align: center; }
  .wp-sign { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 6mm; break-inside: avoid; }
  .wp-sign > div { border: .6pt solid var(--wp-line); border-radius: 1.5mm; padding: 2mm; min-height: 16mm;
    display: flex; flex-direction: column; justify-content: space-between; gap: 2mm; }
  .wp-banner { border: 1.2pt solid var(--wp-red); background: #fdeceb; border-radius: 2mm; padding: 2mm 3mm;
    margin-bottom: 3mm; font-size: 1.05em; white-space: pre-wrap; }
  .wp-banner strong { color: var(--wp-red); }
  .wp-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 3mm; }
  .wp-card { border: .9pt solid var(--wp-line); border-radius: 2.5mm; padding: 2.5mm; break-inside: avoid;
    page-break-inside: avoid; display: flex; flex-direction: column; gap: 1.5mm; }
  .wp-card-head { display: flex; align-items: center; gap: 2mm; }
  .wp-card-title { font-weight: 800; font-size: 1.3em; line-height: 1.2; }
  .wp-card-img { width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: #fafafa;
    border-radius: 1.5mm; border: .6pt solid var(--wp-line); }
  .wp-card-checks { font-size: .9em; margin: 0; }
  @media print {
    html, body, .wp-wrap { background: #fff !important; min-height: 0 !important; }
    .no-print { display: none !important; }
    .wp-stage { padding: 0 !important; background: #fff !important; }
    .wp-paper { margin: 0; padding: 0; box-shadow: none; width: auto; min-height: 0; }
  }
`;

function WiPrintPage() {
  const { code } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const getFn = useServerFn(wiPublicGet);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [printedAt] = useState(() => new Date());
  const [pendingImages, setPendingImages] = useState(0);

  useEffect(() => {
    let alive = true;
    setResult(null);
    setError(null);
    getFn({ data: { code } })
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    QRCode.toDataURL(clientAppPublicPath(`/manual/${code}`), {
      margin: 0,
      width: 240,
      errorCorrectionLevel: "M",
    })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(""));
    return () => {
      alive = false;
    };
  }, [code, getFn]);

  const layout: Layout = search.layout;
  const found = result?.found ? result : null;

  const imageSrcs = useMemo(() => {
    if (!found || !search.images) return [];
    const limit = layout === "poster" ? 1 : 2;
    return found.snapshot.steps.flatMap((s) =>
      stepImages(s, found.mediaUrls, limit).map((m) => found.mediaUrls[m.path]),
    );
  }, [found, search.images, layout]);

  useEffect(() => {
    if (imageSrcs.length === 0) {
      setPendingImages(0);
      return;
    }
    let alive = true;
    let left = imageSrcs.length;
    setPendingImages(left);
    for (const src of imageSrcs) {
      const img = new Image();
      img.onload = img.onerror = () => {
        left -= 1;
        if (alive) setPendingImages(left);
      };
      img.src = src;
    }
    return () => {
      alive = false;
    };
  }, [imageSrcs]);

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const pageCss =
    layout === "poster"
      ? "@page { size: A4 landscape; margin: 8mm; }"
      : "@page { size: A4 portrait; margin: 12mm 12mm 10mm; }";

  return (
    <div className="wp-wrap min-h-[100dvh] bg-muted/40">
      <style>{PRINT_CSS + pageCss}</style>

      <div className="no-print sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2">
          <Button asChild variant="ghost" className="h-11 gap-1 px-2">
            <Link to="/manual/$code" params={{ code }}>
              <ArrowLeft className="h-5 w-5" /> กลับ
            </Link>
          </Button>
          <div
            role="radiogroup"
            aria-label="รูปแบบการพิมพ์"
            className="flex rounded-lg border border-border p-0.5"
          >
            {(
              [
                ["detail", "ละเอียด · A4 แนวตั้ง"],
                ["poster", "โปสเตอร์ติดผนัง · A4 แนวนอน"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={layout === value}
                onClick={() => setSearch({ layout: value })}
                className={cn(
                  "h-10 rounded-md px-3 text-sm transition-colors",
                  layout === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex h-11 items-center gap-2 px-1">
            <Switch
              id="wp-images"
              checked={search.images}
              onCheckedChange={(v) => setSearch({ images: v })}
            />
            <Label htmlFor="wp-images">แสดงรูป</Label>
          </div>
          <div className="flex h-11 items-center gap-2 px-1">
            <Switch
              id="wp-large"
              checked={search.large}
              onCheckedChange={(v) => setSearch({ large: v })}
            />
            <Label htmlFor="wp-large">ตัวอักษรใหญ่</Label>
          </div>
          <Button
            className={cn("ml-auto h-11 gap-2", WI_ACCENT_BTN)}
            disabled={!found}
            onClick={() => window.print()}
          >
            {pendingImages > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {pendingImages > 0 ? `กำลังโหลดรูป (${pendingImages})…` : "พิมพ์"}
          </Button>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-2 text-xs text-muted-foreground">
          พิมพ์เฉพาะฉบับที่เผยแพร่แล้ว · ในหน้าต่างพิมพ์ให้เลือก “กระดาษ A4” และเปิด
          “กราฟิกพื้นหลัง” เพื่อให้กรอบสีแดงติดมาด้วย
        </p>
      </div>

      <div className="wp-stage px-4 py-6">
        {error ? (
          <p className="no-print mx-auto max-w-xl rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
            {error}
          </p>
        ) : !result ? (
          <div className="no-print flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> กำลังเตรียมหน้าพิมพ์…
          </div>
        ) : !found ? (
          <div className="no-print mx-auto max-w-xl space-y-2 rounded-xl border border-dashed bg-background p-8 text-center">
            <p className="font-medium">ไม่พบคู่มือ {code}</p>
            <p className="text-sm text-muted-foreground">
              พิมพ์ได้เฉพาะ WI ที่เผยแพร่แล้วและยังไม่ถูกเก็บถาวร
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "wp-root wp-paper",
              layout === "poster" ? "wp-landscape" : "wp-portrait",
              search.large && "wp-large",
            )}
          >
            {layout === "poster" ? (
              <PosterSheet r={found} qr={qr} showImages={search.images} printedAt={printedAt} />
            ) : (
              <DetailSheet r={found} qr={qr} showImages={search.images} printedAt={printedAt} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
