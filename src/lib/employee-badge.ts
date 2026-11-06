import QRCode from "qrcode";

const DEPT_LABEL: Record<string, string> = {
  production: "ผลิต",
  qc: "QC",
  packing: "แพ็ค",
  maintenance: "ซ่อม",
  office: "ออฟฟิศ",
  stock: "สต๊อก",
  warehouse: "คลัง",
  transport: "ขนส่ง",
};

const NAT_LABEL: Record<string, string> = {
  Thai: "ไทย",
  Burmese: "พม่า",
  Lao: "ลาว",
  Khmer: "เขมร",
  Other: "อื่น ๆ",
};

export type BadgeSource = {
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  nationality: string | null;
  departments: string[];
};

export type BadgePerson = {
  name: string;
  nickname: string | null;
  code: string | null;
  photo: string | null;
  department: string;
  nationality: string;
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

export function currentAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return url;
  return url.replace(/^https:\/\/[a-z0-9]+\.supabase\.co(?=\/storage\/)/, base.replace(/\/$/, ""));
}

function normalizeNationality(raw: string | null): string {
  if (!raw?.trim()) return "—";
  const v = raw.trim();
  const lower = v.toLowerCase();
  if (lower === "thai" || v === "ไทย" || lower === "thailand") return "ไทย";
  if (["burmese", "myanmar", "mm"].includes(lower) || v === "พม่า") return "พม่า";
  if (["lao", "laos"].includes(lower) || v === "ลาว") return "ลาว";
  if (["khmer", "cambodian", "cambodia"].includes(lower) || v === "เขมร") return "เขมร";
  if (lower === "other" || v === "อื่น ๆ") return "อื่น ๆ";
  return NAT_LABEL[v] ?? v;
}

function splitName(full: string): { name: string; nickname: string | null } {
  const m = full.trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { name: m[1].trim(), nickname: m[2].trim() } : { name: full.trim(), nickname: null };
}

export function toBadgePerson(source: BadgeSource): BadgePerson {
  const { name, nickname } = splitName(source.name);
  const department = source.departments.map((d) => DEPT_LABEL[d] ?? d).join(" · ") || "—";
  const code = source.emp_code?.trim() || null;
  return {
    name: name || "—",
    nickname,
    code,
    photo: currentAvatarUrl(source.avatar_url),
    department,
    nationality: normalizeNationality(source.nationality),
  };
}

export function employeeCodeQrSvg(value: string): string {
  let svg = "";
  QRCode.toString(
    value,
    {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1e293b", light: "#ffffff" },
    },
    (err, out) => {
      if (!err && out) svg = out.trim();
    },
  );
  return svg.replace("<svg ", `<svg role="img" aria-label="${esc(value)}" `);
}

const PERSON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="#64748b" stroke-width="1.4"/><path d="M5.5 19.2c1.2-3 3.5-4.5 6.5-4.5s5.3 1.5 6.5 4.5" fill="none" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/></svg>`;

function whiteMarkSrc(): string {
  const path = "/brand/wsc-mark-10-white.png";
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

export function renderBadgeHtml(person: BadgePerson): string {
  const photo = person.photo
    ? `<img src="${esc(person.photo)}" alt="" onerror="this.remove()"/>`
    : "";
  const bars = person.code ? employeeCodeQrSvg(person.code) : "";
  return `<article class="wsc-badge">
    <div class="photo">
      <div class="brand"><img class="mark" src="${esc(whiteMarkSrc())}" alt=""><div class="letters"><b>W</b><b>S</b><b>C</b></div></div>
      <div class="shot">${photo}<div class="ph">${PERSON}</div></div>
    </div>
    <div class="body">
      <p class="name">${esc(person.name)}</p>
      ${person.nickname ? `<p class="nick">${esc(person.nickname)}</p>` : ""}
      <div class="meta">
        <div><strong>แผนก</strong><span>${esc(person.department)}</span></div>
        <div><strong>สัญชาติ</strong><span>${esc(person.nationality)}</span></div>
        <div><strong>รหัส</strong><span>${esc(person.code ?? "—")}</span></div>
      </div>
      <div class="code">${bars}</div>
    </div>
  </article>`;
}

const BADGE_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap";

export const BADGE_CSS = `
  @import url("${BADGE_FONT_HREF}");
  .wsc-badge{width:54mm;height:86mm;display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:0;font-family:"IBM Plex Sans Thai","Leelawadee UI",sans-serif;color:#3f3f46;box-sizing:border-box}
  .photo{position:relative;height:42mm;flex-shrink:0;background:#29a9e1 url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><path d='M0 22L22 0' stroke='white' stroke-opacity='.35' stroke-width='2'/></svg>") 0 0 / 16px 16px}
  .brand{position:absolute;inset:0 auto 0 0;width:16mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:1.4mm;background:#3157a4;z-index:1}
  .brand .mark{width:8.2mm;height:8.2mm;object-fit:contain;display:block;flex-shrink:0}
  .letters{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15mm;min-height:0}
  .brand b{color:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:7.2mm;font-weight:900;line-height:.82}
  .shot{position:absolute;top:3mm;right:0;bottom:0;left:16mm;background:#dbe7f2}
  .shot img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
  .shot:has(img) .ph{display:none}
  .ph{height:100%;display:flex;align-items:flex-end;justify-content:center}
  .ph svg{width:22mm;height:22mm;margin-bottom:4mm}
  .body{flex:1;display:flex;flex-direction:column;padding:2.4mm 3mm 2mm;min-height:0}
  .name{margin:0;color:#3157a4;font-size:3.8mm;font-weight:700;line-height:1.15;text-transform:uppercase}
  .nick{margin:.6mm 0 0;color:#29a9e1;font-size:3.2mm;font-weight:700}
  .meta{display:grid;grid-template-columns:1.1fr .9fr .8fr;gap:1.4mm;margin-top:1.8mm}
  .meta div{border-left:.6mm solid #29a9e1;padding-left:1.2mm;min-width:0}
  .meta strong{display:block;color:#3157a4;font-size:2.1mm}
  .meta span{display:block;font-size:2.5mm;line-height:1.2;overflow:hidden}
  .code{margin-top:auto;padding-top:1mm;display:flex;flex-direction:column;align-items:center}
  .code svg{display:block;width:16mm;height:16mm}
`;

function printWhenReadyScript(): string {
  return `<script>
    var images = [...document.images].map(function(img){
      return img.complete ? Promise.resolve() : new Promise(function(r){ img.onload = img.onerror = r; });
    });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([fonts].concat(images)).then(function(){ setTimeout(function(){ window.print(); }, 300); });
  </script>`;
}

function openPrintWindow(html: string, width: number, height: number) {
  // "noopener" makes Chrome open a blank about:blank window and drop the handle,
  // so the badge HTML never gets written.
  const win = window.open("", "_blank", `width=${width},height=${height}`);
  if (!win) throw new Error("เปิดหน้าต่างพิมพ์ไม่ได้ ลองอนุญาตป๊อปอัป");
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function openBadgePrint(people: BadgePerson[]) {
  const cards = people.map(renderBadgeHtml).join("");
  openPrintWindow(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัตรพนักงาน WSC</title>
    <link rel="stylesheet" href="${BADGE_FONT_HREF}">
    <style>
      @page{size:54mm 86mm;margin:0}
      html,body{margin:0;background:#fff}
      ${BADGE_CSS}
      .wsc-badge{border-radius:0;break-after:page;page-break-after:always}
      .wsc-badge:last-child{break-after:auto;page-break-after:auto}
      @media screen{body{background:#ece7df;display:flex;flex-wrap:wrap;gap:8px;padding:12px}.wsc-badge{box-shadow:0 8px 24px rgba(0,0,0,.18)}}
    </style></head><body>${cards}
    ${printWhenReadyScript()}
    </body></html>`,
    920,
    760,
  );
}

/** A4 portrait holds 3 × 3 real 54×86 mm cards. Dashed lines are the cut guides. */
export function openBadgeA4Print(people: BadgePerson[]) {
  const ready = people.filter((person) => person.photo);
  if (!ready.length) throw new Error("ไม่มีพนักงานที่มีรูปสำหรับพิมพ์บน A4");
  const perPage = 9;
  const pages: string[] = [];
  for (let i = 0; i < ready.length; i += perPage) {
    const cells = ready
      .slice(i, i + perPage)
      .map((person) => `<div class="slot">${renderBadgeHtml(person)}</div>`)
      .join("");
    pages.push(`<section class="sheet">${cells}</section>`);
  }
  openPrintWindow(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัตรพนักงาน A4 ${ready.length} ใบ</title>
    <link rel="stylesheet" href="${BADGE_FONT_HREF}">
    <style>
      @page{size:A4 portrait;margin:0}
      html,body{margin:0;background:#fff}
      ${BADGE_CSS}
      .sheet{width:210mm;height:297mm;box-sizing:border-box;padding:19.5mm 24mm;display:grid;grid-template-columns:repeat(3,54mm);grid-auto-rows:86mm;align-content:start;break-after:page;page-break-after:always}
      .sheet:last-child{break-after:auto;page-break-after:auto}
      .slot{position:relative;width:54mm;height:86mm}
      .slot::after{content:"";position:absolute;inset:0;border:.35mm dashed #475569;pointer-events:none;z-index:2}
      .sheet .wsc-badge{width:54mm;height:86mm;border-radius:0}
      .hint{margin:0;padding:8px 16px;font-family:"IBM Plex Sans Thai","Leelawadee UI",sans-serif;font-size:14px;color:#334155}
      @media print{.hint{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      @media screen{body{background:#d6d3d1}.sheet{margin:12px auto;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.18)}}
    </style></head><body>
    <p class="hint">บันทึกเป็น PDF · กระดาษ A4 แนวตั้ง · ขอบกระดาษ = ไม่มี · เส้นประคือรอยตัด · ${ready.length} ใบ หน้าละ 9 ใบ</p>
    ${pages.join("")}
    ${printWhenReadyScript()}
    </body></html>`,
    980,
    820,
  );
}
