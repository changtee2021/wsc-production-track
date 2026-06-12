// Thermal-printer label page. Loads job by job_no, renders one sticker per qty,
// and auto-opens print dialog. CSS targets ~80mm × 50mm sticker.
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { adminGetJobByNo, type ProductionJobRow } from "@/lib/features/production-jobs.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export const Route = createFileRoute("/_protected/print-label/$jobNo")({
  head: () => ({ meta: [{ title: "พิมพ์ Label" }] }),
  component: PrintLabelPage,
});

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH");
  } catch {
    return d;
  }
}

function PrintLabelPage() {
  const { jobNo } = useParams({ from: "/_protected/print-label/$jobNo" });
  const getFn = useServerFn(adminGetJobByNo);
  const [job, setJob] = useState<ProductionJobRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await getFn({ data: { token: requireToken(), job_no: jobNo } });
        setJob(res.job);
        const dataUrl = await QRCode.toDataURL(res.job.job_no, {
          margin: 1,
          width: 200,
          errorCorrectionLevel: "M",
        });
        setQrDataUrl(dataUrl);
      } catch (e) {
        showError(e, "โหลดใบงานไม่สำเร็จ");
      }
    })();
  }, [getFn, jobNo]);

  useEffect(() => {
    if (job && qrDataUrl) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [job, qrDataUrl]);

  if (!job) return <div className="p-6 text-sm text-muted-foreground">กำลังโหลด…</div>;

  const stickers = Array.from({ length: Math.max(1, job.qty) }, (_, i) => i);

  return (
    <>
      <style>{`
        @page { size: 80mm 50mm; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .sticker { page-break-after: always; }
          .sticker:last-child { page-break-after: auto; }
        }
        .sticker {
          width: 80mm; height: 50mm; padding: 3mm;
          font-family: 'Sarabun', system-ui, -apple-system, sans-serif;
          color: #000; background: #fff; box-sizing: border-box;
          display: grid; grid-template-columns: 1fr auto; gap: 2mm;
          border: 1px dashed #d4d4d8;
        }
        .sticker .body { font-size: 9pt; line-height: 1.25; }
        .sticker .order { font-size: 10pt; font-weight: 800; text-align: right; }
        .sticker .job-big { font-size: 16pt; font-weight: 800; letter-spacing: 0.5px; }
        .sticker .row { display: flex; gap: 2mm; align-items: baseline; }
        .sticker .lbl { color: #555; font-size: 7.5pt; }
        .sticker .qr { width: 22mm; height: 22mm; }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b bg-background p-3 shadow-sm">
        <Button onClick={() => window.print()} size="sm" className="gap-1">
          <Printer className="h-4 w-4" /> พิมพ์อีกครั้ง
        </Button>
        <Button onClick={() => window.close()} size="sm" variant="ghost" className="gap-1">
          <X className="h-4 w-4" /> ปิด
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {stickers.length} ดวง • {job.job_no}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 p-4">
        {stickers.map((i) => (
          <div key={i} className="sticker">
            <div className="body flex flex-col justify-between">
              <div className="flex items-start justify-between gap-1">
                <div className="job-big">{job.job_no}</div>
                <div className="order">{job.order_no ?? ""}</div>
              </div>
              {job.customer_name && (
                <div className="truncate">
                  <span className="lbl">ลูกค้า:</span> {job.customer_name}
                </div>
              )}
              <div className="row">
                <span className="lbl">{job.product_type ?? "—"}</span>
                <strong>
                  {job.width_cm ?? "?"} × {job.height_cm ?? "?"} cm
                </strong>
                {job.side && <span>({job.side})</span>}
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {job.fabric_code && (
                  <span>
                    <span className="lbl">ผ้า:</span> {job.fabric_code}
                  </span>
                )}
                {job.rail_code && (
                  <span>
                    <span className="lbl">ราง:</span> {job.rail_code}
                  </span>
                )}
                {job.color_code && (
                  <span>
                    <span className="lbl">สี:</span> {job.color_code}
                  </span>
                )}
              </div>
              {job.motor && (
                <div>
                  <span className="lbl">มอเตอร์:</span> {job.motor}
                </div>
              )}
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  <span className="lbl">ส่ง:</span> {fmt(job.due_date)}
                </span>
                {job.label_rev && <span className="lbl">{job.label_rev}</span>}
              </div>
            </div>
            <div className="flex flex-col items-center justify-between">
              {qrDataUrl && <img src={qrDataUrl} alt={job.job_no} className="qr" />}
              <div className="text-[7pt]">
                {i + 1}/{stickers.length}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
