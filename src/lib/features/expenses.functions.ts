// Expense scanner — public (worker) flow.
// - issueExpenseSession: free-issue token
// - expenseUploadReceipt: validates + uploads image to private bucket
// - expenseScanReceipt: calls Lovable AI Gateway (gemini-2.5-pro) vision to extract
// - expenseCheckDuplicate: dedupe by (merchant, receipt_no, date)
// - expenseSubmit: persists row + items (snapshots)
// - expenseListMine / expenseResubmit / expenseSignReceiptUrls / expenseListCategories
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  issueExpenseToken,
  verifyExpenseToken,
  issueExpenseMineToken,
  verifyExpenseMineToken,
} from "@/lib/auth/expense-token.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { notifyExpenseSubmitted } from "@/lib/integrations/line-notify.server";

const BUCKET = "expense-receipts";
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB / receipt image
const SIGN_TTL = 60 * 60;

const tokenStr = z.string().min(1);

function assertExpenseOrAdmin(token: string | undefined) {
  if (verifyExpenseToken(token)) return;
  if (verifyAdminToken(token)) return;
  throw new Error("Unauthorized");
}
function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

// In-memory rate limit (10 scans/min/IP)
const scanBuckets = new Map<string, number[]>();
function checkScanLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60_000;
  const arr = (scanBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= 10) {
    scanBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  scanBuckets.set(ip, arr);
  return true;
}

// ============ ISSUE SESSION ============
export const issueExpenseSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async () => {
    return { token: issueExpenseToken() };
  });

// ============ LIST CATEGORIES ============
export const expenseListCategories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("expense_categories")
      .select("id, name, keywords, sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ============ UPLOAD RECEIPT IMAGE ============
function detectImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { mime: "image/png", ext: "png" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return { mime: "image/webp", ext: "webp" };
  // PDF (%PDF-)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export const expenseUploadReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      dataBase64: z.string().min(1).max(Math.ceil((MAX_BYTES * 4) / 3) + 16),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const ip = clientIp();
    if (!checkScanLimit(ip)) throw new Error("อัปโหลดบ่อยเกินไป รอสักครู่");

    const bytes = Uint8Array.from(Buffer.from(data.dataBase64, "base64"));
    if (bytes.length === 0) throw new Error("ไฟล์ว่างเปล่า");
    if (bytes.length > MAX_BYTES) throw new Error("ไฟล์ใหญ่เกิน 6MB");
    const detected = detectImage(bytes);
    if (!detected) throw new Error("รองรับเฉพาะ JPG, PNG, WEBP, PDF");

    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${detected.ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET).upload(path, bytes, { contentType: detected.mime, upsert: false });
    if (error) throw new Error(error.message);

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET).createSignedUrl(path, SIGN_TTL);
    return { path, previewUrl: signed?.signedUrl ?? "", mime: detected.mime };
  });

// ============ SCAN (AI Vision) ============
const scanInput = z.object({
  token: tokenStr,
  image_paths: z.array(z.string().min(1)).min(1).max(3),
});

type ScannedReceipt = {
  bill_type: "cash" | "short_tax" | "full_tax";
  merchant_name: string | null;
  tax_id: string | null;
  receipt_no: string | null;
  receipt_date: string | null; // YYYY-MM-DD
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  buyer_match_wsc: boolean;
  suggested_category_id: string | null;
  confidence: number;
  notes: string | null;
};

export const expenseScanReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scanInput.parse(d))
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const ip = clientIp();
    if (!checkScanLimit(ip)) throw new Error("เรียก AI บ่อยเกินไป รอสักครู่");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ไม่ได้ตั้งค่า");

    // Load categories for AI mapping
    const { data: cats } = await supabaseAdmin
      .from("expense_categories")
      .select("id, name, keywords").eq("active", true);
    const catHint = (cats ?? []).map((c) => ({
      id: c.id, name: c.name, keywords: c.keywords ?? [],
    }));

    // Fetch image bytes from private bucket → base64 data URLs for vision
    const imageMessages: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    for (const p of data.image_paths) {
      const { data: dl, error } = await supabaseAdmin.storage.from(BUCKET).download(p);
      if (error || !dl) throw new Error(`ไม่พบรูป: ${p}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      // Only support image/* in vision; PDFs are uploaded but skipped here.
      const mime = dl.type || "image/jpeg";
      if (!mime.startsWith("image/")) continue;
      imageMessages.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${buf.toString("base64")}` },
      });
    }
    if (imageMessages.length === 0) {
      // PDFs only — return empty scan, user fills manually
      return {
        ok: true as const,
        scan: {
          bill_type: "cash", merchant_name: null, tax_id: null,
          receipt_no: null, receipt_date: null,
          subtotal: 0, vat_amount: 0, total_amount: 0,
          buyer_match_wsc: false, suggested_category_id: null,
          confidence: 0, notes: "ไฟล์ PDF — กรุณากรอกข้อมูลด้วยตนเอง",
        } as ScannedReceipt,
        raw: null,
      };
    }

    const system =
      "คุณเป็นผู้ช่วยอ่านใบเสร็จภาษาไทย ให้สกัดข้อมูลและตอบเป็น JSON เท่านั้น " +
      "ตามสคีมานี้พอดี (ห้ามมี markdown / code fence / คำอธิบายอื่น):\n" +
      `{\n` +
      `  "bill_type": "cash" | "short_tax" | "full_tax",\n` +
      `  "merchant_name": string | null,\n` +
      `  "tax_id": string | null,        // เลข 13 หลัก ถ้ามี\n` +
      `  "receipt_no": string | null,    // เลขที่บิล/ใบเสร็จ\n` +
      `  "receipt_date": "YYYY-MM-DD" | null,  // แปลง พ.ศ.เป็น ค.ศ. (-543)\n` +
      `  "subtotal": number,             // ยอดก่อน VAT (บาท)\n` +
      `  "vat_amount": number,           // VAT 7%\n` +
      `  "total_amount": number,         // ยอดรวมที่จ่ายจริง\n` +
      `  "buyer_match_wsc": boolean,     // ชื่อผู้ซื้อมีคำว่า WSC หรือ วิสุทธิ์ศิลป์\n` +
      `  "suggested_category_id": string | null,\n` +
      `  "confidence": number,           // 0-1\n` +
      `  "notes": string | null\n` +
      `}\n\n` +
      "กฎ:\n" +
      "- bill_type=full_tax ถ้ามีคำว่า 'ใบกำกับภาษี' พร้อมเลขผู้เสียภาษีและที่อยู่ผู้ซื้อ\n" +
      "- bill_type=short_tax ถ้ามีคำว่า 'ใบกำกับภาษีอย่างย่อ' หรือมีเลขผู้เสียภาษีแต่ไม่มีที่อยู่ผู้ซื้อ\n" +
      "- bill_type=cash ถ้าเป็นบิลเงินสดทั่วไป\n" +
      "- บิลย่อ: ถ้าไม่มี VAT แยกบรรทัด คำนวณ vat_amount = total_amount * 7/107, subtotal = total - vat\n" +
      "- บิลเต็ม: ใช้ตัวเลข VAT ที่ปรากฏจริง\n" +
      "- เดา suggested_category_id จากชื่อร้าน/รายการ เทียบกับ keywords ของหมวด (id เป็น UUID)\n" +
      "หมวดที่มี: " + JSON.stringify(catHint);

    const userContent: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = [
      { type: "text", text: "อ่านใบเสร็จต่อไปนี้แล้วตอบเป็น JSON ตามสคีมา:" },
      ...imageMessages,
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI ใช้งานหนาก ลองใหม่อีกครู่");
    if (res.status === 402) throw new Error("เครดิต AI หมด — เพิ่มเครดิตที่ Settings");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";

    let parsed: Partial<ScannedReceipt> = {};
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      parsed = {};
    }

    const scan: ScannedReceipt = {
      bill_type: (["cash", "short_tax", "full_tax"].includes(String(parsed.bill_type))
        ? parsed.bill_type : "cash") as ScannedReceipt["bill_type"],
      merchant_name: parsed.merchant_name ?? null,
      tax_id: parsed.tax_id ?? null,
      receipt_no: parsed.receipt_no ?? null,
      receipt_date: parsed.receipt_date ?? null,
      subtotal: Number(parsed.subtotal ?? 0) || 0,
      vat_amount: Number(parsed.vat_amount ?? 0) || 0,
      total_amount: Number(parsed.total_amount ?? 0) || 0,
      buyer_match_wsc: Boolean(parsed.buyer_match_wsc),
      suggested_category_id: parsed.suggested_category_id ?? null,
      confidence: Number(parsed.confidence ?? 0.5) || 0.5,
      notes: parsed.notes ?? null,
    };

    return { ok: true as const, scan, raw };
  });

// ============ DUPLICATE CHECK ============
export const expenseCheckDuplicate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      merchant_name: z.string().trim().min(1),
      receipt_no: z.string().trim().min(1),
      receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      exclude_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    let q = supabaseAdmin
      .from("expenses")
      .select("id, exp_no, status, requester_name, total_amount, created_at")
      .ilike("merchant_name", data.merchant_name)
      .eq("receipt_no", data.receipt_no)
      .eq("receipt_date", data.receipt_date)
      .neq("status", "rejected")
      .limit(3);
    if (data.exclude_id) q = q.neq("id", data.exclude_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { duplicates: rows ?? [] };
  });

// ============ SUBMIT ============
const submitInput = z.object({
  token: tokenStr,
  requester_employee_id: z.string().uuid(),
  bill_type: z.enum(["cash", "short_tax", "full_tax"]),
  merchant_name: z.string().trim().max(200).optional(),
  tax_id: z.string().trim().max(20).optional(),
  receipt_no: z.string().trim().max(60).optional(),
  receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subtotal: z.number().min(0).max(10_000_000).default(0),
  vat_amount: z.number().min(0).max(10_000_000).default(0),
  total_amount: z.number().min(0).max(10_000_000),
  category_id: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).optional(),
  image_paths: z.array(z.string()).min(1).max(3),
  buyer_match_wsc: z.boolean().default(false),
  linked_office_request_id: z.string().uuid().nullable().optional(),
  ai_extracted: z.unknown().optional(),
  ai_confidence: z.number().min(0).max(1).optional(),
});

export const expenseSubmit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitInput.parse(d))
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);

    // Look up requester (any employee group — try office, qc, packing, maintenance, employees)
    const tables = ["office_employees", "employees", "qc_employees", "packing_employees", "maintenance_employees"] as const;
    let requesterName: string | null = null;
    for (const t of tables) {
      const { data: emp } = await supabaseAdmin
        .from(t).select("name, active").eq("id", data.requester_employee_id).maybeSingle();
      if (emp) { requesterName = emp.active ? emp.name : null; break; }
    }
    if (!requesterName) throw new Error("ไม่พบพนักงาน หรือพนักงานถูกปิดใช้งาน");

    // Duplicate check (best-effort; DB unique index is the source of truth)
    let duplicateOf: string | null = null;
    if (data.merchant_name && data.receipt_no && data.receipt_date) {
      const { data: dup } = await supabaseAdmin
        .from("expenses")
        .select("id")
        .ilike("merchant_name", data.merchant_name)
        .eq("receipt_no", data.receipt_no)
        .eq("receipt_date", data.receipt_date)
        .neq("status", "rejected")
        .limit(1).maybeSingle();
      if (dup) duplicateOf = dup.id;
    }

    const insertRow = {
      requester_employee_id: data.requester_employee_id,
      requester_name: requesterName,
      bill_type: data.bill_type,
      merchant_name: data.merchant_name ?? null,
      tax_id: data.tax_id ?? null,
      receipt_no: data.receipt_no ?? null,
      receipt_date: data.receipt_date ?? null,
      subtotal: data.subtotal ?? 0,
      vat_amount: data.vat_amount ?? 0,
      total_amount: data.total_amount,
      category_id: data.category_id ?? null,
      note: data.note ?? null,
      image_paths: data.image_paths,
      buyer_match_wsc: data.buyer_match_wsc,
      linked_office_request_id: data.linked_office_request_id ?? null,
      ai_extracted: (data.ai_extracted ?? null) as never,
      ai_confidence: data.ai_confidence ?? null,
      status: "pending" as const,
      duplicate_of: duplicateOf,
    };

    const { data: created, error } = await supabaseAdmin
      .from("expenses").insert(insertRow as never).select("id, exp_no").single();
    if (error) {
      if (error.message.toLowerCase().includes("uniq_expenses_dedupe")) {
        throw new Error("ใบเสร็จนี้ถูกบันทึกซ้ำในระบบ (ร้าน + เลขที่ + วันที่)");
      }
      throw new Error(error.message);
    }

    await supabaseAdmin.from("expense_status_history").insert({
      expense_id: created.id, from_status: null, to_status: "pending",
      changed_by: requesterName, note: null,
    });

    // Fire-and-forget LINE notify
    notifyExpenseSubmitted({
      exp_no: created.exp_no,
      requester_name: requesterName,
      merchant_name: data.merchant_name ?? null,
      total: data.total_amount,
      bill_type: data.bill_type,
    }).catch(() => {});

    return { ok: true, id: created.id, exp_no: created.exp_no, duplicate_of: duplicateOf };
  });

// ============ LIST MINE ============
export const expenseListMine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      requester_employee_id: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("requester_employee_id", data.requester_employee_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ============ RESUBMIT (re-open a rejected expense) ============
export const expenseResubmit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      // optional patches
      merchant_name: z.string().trim().max(200).optional(),
      receipt_no: z.string().trim().max(60).optional(),
      receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      total_amount: z.number().min(0).max(10_000_000).optional(),
      note: z.string().trim().max(500).optional(),
      add_image_paths: z.array(z.string()).max(3).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("expenses").select("*").eq("id", data.id).single();
    if (error || !row) throw new Error("ไม่พบรายการ");
    if (row.status !== "rejected") throw new Error("รายการนี้ยื่นใหม่ไม่ได้");

    const patch: Record<string, unknown> = { status: "pending", reject_reason: null };
    if (data.merchant_name !== undefined) patch.merchant_name = data.merchant_name;
    if (data.receipt_no !== undefined) patch.receipt_no = data.receipt_no;
    if (data.receipt_date !== undefined) patch.receipt_date = data.receipt_date;
    if (data.total_amount !== undefined) patch.total_amount = data.total_amount;
    if (data.note !== undefined) patch.note = data.note;
    if (data.add_image_paths?.length) {
      patch.image_paths = [...(row.image_paths ?? []), ...data.add_image_paths];
    }

    const { error: upErr } = await supabaseAdmin
      .from("expenses").update(patch as never).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("expense_status_history").insert({
      expense_id: data.id, from_status: "rejected", to_status: "pending",
      changed_by: row.requester_name, note: "ยื่นใหม่",
    });

    return { ok: true };
  });

// ============ SIGN RECEIPT URLS ============
export const expenseSignReceiptUrls = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      paths: z.array(z.string().min(1)).min(1).max(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET).createSignedUrls(data.paths, SIGN_TTL);
    const urlMap: Record<string, string> = {};
    (signed ?? []).forEach((row, i) => {
      if (row.signedUrl) urlMap[data.paths[i]] = row.signedUrl;
    });
    return { urlMap };
  });

// ============ LIST EMPLOYEES (public) ============
// Combined list of office + production employees so anyone can submit.
export const expenseListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertExpenseOrAdmin(data.token);
    const [office, prod] = await Promise.all([
      supabaseAdmin.from("office_employees").select("id, name, emp_code").eq("active", true),
      supabaseAdmin.from("employees").select("id, name, emp_code").eq("active", true),
    ]);
    if (office.error) throw new Error(office.error.message);
    if (prod.error) throw new Error(prod.error.message);
    const seen = new Set<string>();
    const merged = [
      ...(office.data ?? []).map((e) => ({ ...e, group: "office" as const })),
      ...(prod.data ?? []).map((e) => ({ ...e, group: "production" as const })),
    ].filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id); return true;
    });
    merged.sort((a, b) => a.name.localeCompare(b.name, "th"));
    return { rows: merged };
  });
