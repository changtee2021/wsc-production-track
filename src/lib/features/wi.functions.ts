// Work Instruction (WI) server functions.
// Admin token: create / edit drafts / submit / archive / categories / links.
// WI reviewer token: approve & publish, request changes.
// Public (no login): read the *published snapshot* only — drafts never leave the server.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import {
  checkWiReviewPassword,
  issueWiReviewToken,
  verifyWiReviewToken,
} from "@/lib/auth/wi-review-token.server";
import { APP_SLUG, SUPABASE_SCHEMA } from "@/lib/erp-config";
import { aiChatCompletions, flashModelId } from "@/lib/ai/ai-provider.server";
import {
  WI_STATUSES,
  collectMediaPaths,
  localizeSnapshot,
  normalizeTranslations,
  wiDocInputSchema,
  wiTranslationSchema,
  type WiTranslation,
  type WiDocInput,
  type WiRelatedDoc,
  type WiSnapshot,
  type WiStatus,
  type WiStepContent,
} from "@/lib/wi/wi-schema";

const BUCKET = "wi-media";
const SIGN_TTL = 60 * 60;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp"] as const;
const VIDEO_EXT = ["mp4", "webm", "mov"] as const;
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
const PATH_RE = /^[a-z_]+\/wi\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm|mov)$/;

const tokenStr = z.string().min(1);
const actorStr = z.string().trim().min(1, "กรอกชื่อผู้ใช้งานก่อน").max(120);
const uuid = z.string().uuid();

// The generated Database types only cover `public`; WI tables live in the app
// schema, so use an untyped view of the same service-role client.
function db(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function assertAdmin(token: string) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

function assertReviewer(token: string) {
  if (!verifyWiReviewToken(token)) throw new Error("ReviewerUnauthorized");
}

function fail(err: { message: string; code?: string } | null, fallback = "เกิดข้อผิดพลาด"): never {
  if (err?.code === "23505") throw new Error("ข้อมูลซ้ำกับที่มีอยู่แล้ว");
  if (err?.code === "23503") throw new Error("ข้อมูลยังถูกอ้างอิงอยู่ ลบไม่ได้");
  console.error("[wi]", err);
  throw new Error(fallback);
}

// ---- Row shapes ------------------------------------------------------------

const DOC_COLS =
  "id, wi_code, title, description, category_id, owner_name, tags, est_minutes, equipment, safety_notes, related_docs, draft_content, status, has_unpublished_changes, pending_change_summary, current_version_id, submitted_by_name, submitted_at, published_at, archived_at, created_at, updated_at, created_by_name, updated_by_name";

const LIST_COLS =
  "id, wi_code, title, category_id, owner_name, tags, status, has_unpublished_changes, current_version_id, published_at, archived_at, created_at, updated_at, updated_by_name";

export type WiDocRow = {
  id: string;
  wi_code: string;
  title: string;
  description: string | null;
  category_id: string | null;
  owner_name: string | null;
  tags: string[];
  est_minutes: number | null;
  equipment: string | null;
  safety_notes: string | null;
  related_docs: WiRelatedDoc[];
  draft_content: { steps?: unknown; translations?: unknown };
  status: WiStatus;
  has_unpublished_changes: boolean;
  pending_change_summary: string | null;
  current_version_id: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
};

export type WiListRow = Pick<
  WiDocRow,
  | "id"
  | "wi_code"
  | "title"
  | "category_id"
  | "owner_name"
  | "tags"
  | "status"
  | "has_unpublished_changes"
  | "current_version_id"
  | "published_at"
  | "archived_at"
  | "created_at"
  | "updated_at"
  | "updated_by_name"
> & { category_name: string | null; version: { major: number; minor: number } | null };

export type WiVersionRow = {
  id: string;
  wi_id: string;
  major: number;
  minor: number;
  change_summary: string | null;
  editor_name: string | null;
  reviewer_name: string | null;
  published_at: string;
};

export type WiCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WiActivityDetail = Record<string, string | number | boolean | null>;

export type WiActivityRow = {
  id: string;
  wi_id: string | null;
  action: string;
  actor_name: string | null;
  detail: WiActivityDetail;
  created_at: string;
  wi_code?: string | null;
  title?: string | null;
};

const VERSION_COLS =
  "id, wi_id, major, minor, change_summary, editor_name, reviewer_name, published_at";

// Tolerant read of stored step JSON: older/partial rows still render.
function normalizeSteps(raw: unknown): WiStepContent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      id: String(s.id ?? crypto.randomUUID()),
      title: String(s.title ?? ""),
      instructions: String(s.instructions ?? ""),
      note: String(s.note ?? ""),
      warning: String(s.warning ?? ""),
      expected_result: String(s.expected_result ?? ""),
      media: Array.isArray(s.media) ? (s.media as WiStepContent["media"]) : [],
      checkpoints: Array.isArray(s.checkpoints)
        ? (s.checkpoints as WiStepContent["checkpoints"])
        : [],
    }));
}

function normalizeSnapshot(raw: unknown): WiSnapshot {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    wi_code: String(r.wi_code ?? ""),
    title: String(r.title ?? ""),
    description: (r.description as string | null) ?? null,
    category_id: (r.category_id as string | null) ?? null,
    category_name: (r.category_name as string | null) ?? null,
    owner_name: (r.owner_name as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    est_minutes: typeof r.est_minutes === "number" ? r.est_minutes : null,
    equipment: (r.equipment as string | null) ?? null,
    safety_notes: (r.safety_notes as string | null) ?? null,
    related_docs: Array.isArray(r.related_docs) ? (r.related_docs as WiRelatedDoc[]) : [],
    steps: normalizeSteps(r.steps),
    translations: normalizeTranslations(r.translations),
  };
}

function mediaPathAllowed(p: string): boolean {
  return PATH_RE.test(p) && p.startsWith(`${SUPABASE_SCHEMA}/wi/`);
}

function assertMediaPaths(steps: WiStepContent[]) {
  for (const p of collectMediaPaths(steps)) {
    if (!mediaPathAllowed(p)) throw new Error("พบไฟล์สื่อที่ไม่ได้อัปโหลดผ่านระบบ WI");
  }
}

async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(mediaPathAllowed)));
  if (unique.length === 0) return {};
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(unique, SIGN_TTL);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((row, i) => {
    if (row.signedUrl) out[unique[i]] = row.signedUrl;
  });
  return out;
}

function docFields(d: WiDocInput) {
  const tags = Array.from(new Set(d.tags.map((t) => t.trim()).filter(Boolean)));
  return {
    title: d.title.trim(),
    description: d.description.trim() || null,
    category_id: d.category_id,
    owner_name: d.owner_name.trim() || null,
    tags,
    est_minutes: d.est_minutes,
    equipment: d.equipment.trim() || null,
    safety_notes: d.safety_notes.trim() || null,
    related_docs: d.related_docs,
    draft_content: { steps: d.steps, translations: d.translations },
  };
}

async function logActivity(
  wiId: string | null,
  action: string,
  actor: string | null,
  detail: WiActivityDetail = {},
) {
  const { error } = await db()
    .from("wi_activity")
    .insert({ wi_id: wiId, action, actor_name: actor, detail });
  if (error) console.error("[wi] activity log failed", error);
}

async function loadDoc(id: string): Promise<WiDocRow> {
  const { data, error } = await db()
    .from("wi_documents")
    .select(DOC_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error, "โหลด WI ไม่สำเร็จ");
  if (!data) throw new Error("ไม่พบ WI");
  return data as WiDocRow;
}

async function versionsById(ids: string[]) {
  const out: Record<string, { major: number; minor: number }> = {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;
  const { data, error } = await db()
    .from("wi_versions")
    .select("id, major, minor")
    .in("id", unique);
  if (error) fail(error);
  for (const v of (data ?? []) as { id: string; major: number; minor: number }[]) {
    out[v.id] = { major: v.major, minor: v.minor };
  }
  return out;
}

async function categoryNames(ids: string[]) {
  const out: Record<string, string> = {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;
  const { data, error } = await db().from("wi_categories").select("id, name").in("id", unique);
  if (error) fail(error);
  for (const c of (data ?? []) as { id: string; name: string }[]) out[c.id] = c.name;
  return out;
}

// ---- Reviewer auth ---------------------------------------------------------

export const wiReviewerLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    // Local `vite dev` only (same convention as admin login).
    if (import.meta.env.DEV && process.env.NODE_ENV !== "production") {
      if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 6) {
        process.env.ADMIN_PASSWORD = "local-dev-admin-secret";
      }
      if (!process.env.WI_REVIEWER_PASSWORD || process.env.WI_REVIEWER_PASSWORD.length < 6) {
        process.env.WI_REVIEWER_PASSWORD = "local-dev-wi-review";
      }
      return { ok: true as const, token: issueWiReviewToken() };
    }
    if (!process.env.WI_REVIEWER_PASSWORD || process.env.WI_REVIEWER_PASSWORD.length < 6) {
      return { ok: false as const, error: "ยังไม่ได้ตั้งค่ารหัสผู้อนุมัติ (WI_REVIEWER_PASSWORD)" };
    }
    if (data.password.length < 1 || !checkWiReviewPassword(data.password)) {
      return { ok: false as const, error: "รหัสผ่านไม่ถูกต้อง" };
    }
    return { ok: true as const, token: issueWiReviewToken() };
  });

export const wiCheckReviewer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => ({ ok: verifyWiReviewToken(data.token) }));

// ---- Dashboard -------------------------------------------------------------

export const wiDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const count = () => db().from("wi_documents").select("id", { count: "exact", head: true });
    const [total, published, drafts, pending, archived, activity, pendingList] = await Promise.all([
      count(),
      count().not("current_version_id", "is", null).neq("status", "archived"),
      count().eq("status", "draft"),
      count().eq("status", "pending_review"),
      count().eq("status", "archived"),
      db()
        .from("wi_activity")
        .select("id, wi_id, action, actor_name, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      db()
        .from("wi_documents")
        .select("id, wi_code, title, submitted_by_name, submitted_at")
        .eq("status", "pending_review")
        .order("submitted_at", { ascending: true })
        .limit(5),
    ]);
    for (const r of [total, published, drafts, pending, archived, activity, pendingList]) {
      if (r.error) fail(r.error, "โหลดภาพรวม WI ไม่สำเร็จ");
    }
    const acts = (activity.data ?? []) as WiActivityRow[];
    const wiIds = Array.from(new Set(acts.map((a) => a.wi_id).filter((x): x is string => !!x)));
    const docs: Record<string, { wi_code: string; title: string }> = {};
    if (wiIds.length) {
      const { data: rows, error } = await db()
        .from("wi_documents")
        .select("id, wi_code, title")
        .in("id", wiIds);
      if (error) fail(error);
      for (const r of (rows ?? []) as { id: string; wi_code: string; title: string }[])
        docs[r.id] = r;
    }
    return {
      counts: {
        total: total.count ?? 0,
        published: published.count ?? 0,
        drafts: drafts.count ?? 0,
        pending: pending.count ?? 0,
        archived: archived.count ?? 0,
      },
      activity: acts.map((a) => ({
        ...a,
        wi_code: a.wi_id ? (docs[a.wi_id]?.wi_code ?? null) : null,
        title: a.wi_id ? (docs[a.wi_id]?.title ?? null) : null,
      })),
      pending: (pendingList.data ?? []) as {
        id: string;
        wi_code: string;
        title: string;
        submitted_by_name: string | null;
        submitted_at: string | null;
      }[],
    };
  });

// ---- Library ---------------------------------------------------------------

const SORT_COLS = {
  updated: "updated_at",
  created: "created_at",
  title: "title",
  code: "wi_code",
} as const;

export const wiList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        q: z.string().max(100).default(""),
        category_id: uuid.nullable().default(null),
        status: z.enum(["active", "all", ...WI_STATUSES]).default("active"),
        owner: z.string().max(120).nullable().default(null),
        sort: z.enum(["updated", "created", "title", "code"]).default("updated"),
        dir: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().int().min(1).max(10_000).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let query = db().from("wi_documents").select(LIST_COLS, { count: "exact" });

    if (data.status === "active") query = query.neq("status", "archived");
    else if (data.status !== "all") query = query.eq("status", data.status);
    if (data.category_id) query = query.eq("category_id", data.category_id);
    if (data.owner) query = query.eq("owner_name", data.owner);

    // Strip PostgREST filter syntax characters from free text.
    const q = data.q.replace(/[,()%*\\:"'{}]/g, " ").trim();
    if (q) {
      const ors = [`title.ilike.%${q}%`, `wi_code.ilike.%${q}%`, `description.ilike.%${q}%`];
      if (!/\s/.test(q)) ors.push(`tags.cs.{${q}}`);
      query = query.or(ors.join(","));
    }

    const from = (data.page - 1) * data.pageSize;
    const {
      data: rows,
      count,
      error,
    } = await query
      .order(SORT_COLS[data.sort], { ascending: data.dir === "asc" })
      .order("wi_code", { ascending: true })
      .range(from, from + data.pageSize - 1);
    if (error) fail(error, "โหลดรายการ WI ไม่สำเร็จ");

    const list = (rows ?? []) as Omit<WiListRow, "category_name" | "version">[];
    const [cats, vers, ownersRes, allCats] = await Promise.all([
      categoryNames(list.map((r) => r.category_id ?? "")),
      versionsById(list.map((r) => r.current_version_id ?? "")),
      db().from("wi_documents").select("owner_name").not("owner_name", "is", null).limit(2000),
      db().from("wi_categories").select("id, name, is_active").order("sort_order").order("name"),
    ]);
    if (ownersRes.error) fail(ownersRes.error);
    if (allCats.error) fail(allCats.error);
    const owners = Array.from(
      new Set(((ownersRes.data ?? []) as { owner_name: string }[]).map((o) => o.owner_name)),
    ).sort((a, b) => a.localeCompare(b, "th"));

    return {
      rows: list.map((r): WiListRow => ({
        ...r,
        category_name: r.category_id ? (cats[r.category_id] ?? null) : null,
        version: r.current_version_id ? (vers[r.current_version_id] ?? null) : null,
      })),
      total: count ?? 0,
      owners,
      categories: (allCats.data ?? []) as { id: string; name: string; is_active: boolean }[],
    };
  });

// ---- Detail ----------------------------------------------------------------

export const wiGet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const doc = await loadDoc(data.id);
    const steps = normalizeSteps(doc.draft_content?.steps);
    const translations = normalizeTranslations(doc.draft_content?.translations);

    const [versions, reviews, links, activity, cats, prodSteps, prodCats] = await Promise.all([
      db()
        .from("wi_versions")
        .select(VERSION_COLS)
        .eq("wi_id", doc.id)
        .order("major", { ascending: false })
        .order("minor", { ascending: false }),
      db()
        .from("wi_reviews")
        .select("id, version_id, outcome, comment, actor_name, created_at")
        .eq("wi_id", doc.id)
        .order("created_at", { ascending: false })
        .limit(50),
      db()
        .from("wi_production_links")
        .select("id, step_id, category_id, created_at")
        .eq("wi_id", doc.id)
        .order("created_at"),
      db()
        .from("wi_activity")
        .select("id, wi_id, action, actor_name, detail, created_at")
        .eq("wi_id", doc.id)
        .order("created_at", { ascending: false })
        .limit(30),
      db().from("wi_categories").select("id, name, is_active").order("sort_order").order("name"),
      supabaseAdmin.from("steps").select("id, step_name, active").order("step_name"),
      supabaseAdmin.from("categories").select("id, name, active").order("name"),
    ]);
    for (const r of [versions, reviews, links, activity, cats, prodSteps, prodCats]) {
      if (r.error) fail(r.error, "โหลดรายละเอียด WI ไม่สำเร็จ");
    }

    const stepName = new Map(
      ((prodSteps.data ?? []) as { id: string; step_name: string }[]).map((s) => [
        s.id,
        s.step_name,
      ]),
    );
    const catName = new Map(
      ((prodCats.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    );

    const docView: Partial<WiDocRow> = { ...doc };
    delete docView.draft_content;

    return {
      doc: { ...(docView as Omit<WiDocRow, "draft_content">), steps, translations },
      versions: (versions.data ?? []) as WiVersionRow[],
      reviews: (reviews.data ?? []) as {
        id: string;
        version_id: string | null;
        outcome: "submitted" | "approved" | "changes_requested";
        comment: string | null;
        actor_name: string;
        created_at: string;
      }[],
      links: (
        (links.data ?? []) as { id: string; step_id: string; category_id: string | null }[]
      ).map((l) => ({
        ...l,
        step_name: stepName.get(l.step_id) ?? "—",
        category_name: l.category_id ? (catName.get(l.category_id) ?? "—") : null,
      })),
      activity: (activity.data ?? []) as WiActivityRow[],
      categories: (cats.data ?? []) as { id: string; name: string; is_active: boolean }[],
      productionSteps: (
        (prodSteps.data ?? []) as { id: string; step_name: string; active: boolean }[]
      ).filter((s) => s.active),
      productionCategories: (
        (prodCats.data ?? []) as { id: string; name: string; active: boolean }[]
      ).filter((c) => c.active),
      mediaUrls: await signPaths(collectMediaPaths(steps)),
    };
  });

// ---- Create / save ---------------------------------------------------------

export const wiCreate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, actor: actorStr, doc: wiDocInputSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    assertMediaPaths(data.doc.steps);
    const { data: row, error } = await db()
      .from("wi_documents")
      .insert({
        ...docFields(data.doc),
        status: "draft",
        created_by_name: data.actor,
        updated_by_name: data.actor,
      })
      .select("id, wi_code")
      .single();
    if (error || !row) fail(error, "สร้าง WI ไม่สำเร็จ");
    await logActivity(row.id, "created", data.actor);
    return { id: row.id as string, wi_code: row.wi_code as string };
  });

export const wiSaveDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        actor: actorStr,
        id: uuid,
        base_updated_at: z.string().max(64),
        doc: wiDocInputSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    assertMediaPaths(data.doc.steps);
    const cur = await loadDoc(data.id);
    if (cur.status === "archived") throw new Error("WI นี้ถูกเก็บถาวร — กู้คืนก่อนแก้ไข");
    if (cur.status === "pending_review") {
      throw new Error("WI นี้อยู่ระหว่างรอตรวจ — ถอนคำขอก่อนแก้ไข");
    }
    const { data: rows, error } = await db()
      .from("wi_documents")
      .update({
        ...docFields(data.doc),
        status: "draft",
        has_unpublished_changes: true,
        updated_by_name: data.actor,
      })
      .eq("id", data.id)
      .eq("updated_at", data.base_updated_at)
      .select("updated_at");
    if (error) fail(error, "บันทึกร่างไม่สำเร็จ");
    if (!rows || rows.length === 0) {
      throw new Error("มีการแก้ไข WI นี้จากที่อื่นหลังจากที่คุณเปิด — โหลดหน้าใหม่ก่อนบันทึก");
    }
    await logActivity(data.id, "updated", data.actor);
    return { updated_at: (rows[0] as { updated_at: string }).updated_at };
  });

export const wiDuplicate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, actor: actorStr, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const src = await loadDoc(data.id);
    const { data: row, error } = await db()
      .from("wi_documents")
      .insert({
        title: `${src.title} (สำเนา)`.slice(0, 200),
        description: src.description,
        category_id: src.category_id,
        owner_name: src.owner_name,
        tags: src.tags,
        est_minutes: src.est_minutes,
        equipment: src.equipment,
        safety_notes: src.safety_notes,
        related_docs: src.related_docs,
        draft_content: {
          steps: normalizeSteps(src.draft_content?.steps),
          translations: normalizeTranslations(src.draft_content?.translations),
        },
        status: "draft",
        created_by_name: data.actor,
        updated_by_name: data.actor,
      })
      .select("id, wi_code")
      .single();
    if (error || !row) fail(error, "คัดลอก WI ไม่สำเร็จ");
    await logActivity(row.id, "duplicated", data.actor, { from_code: src.wi_code });
    return { id: row.id as string, wi_code: row.wi_code as string };
  });

// ---- Workflow --------------------------------------------------------------

export const wiSubmit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        actor: actorStr,
        id: uuid,
        change_summary: z.string().trim().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const cur = await loadDoc(data.id);
    if (cur.status !== "draft") {
      throw new Error(
        cur.status === "published"
          ? "ไม่มีการเปลี่ยนแปลงใหม่ให้ส่งตรวจ"
          : "ส่งตรวจได้เฉพาะ WI ที่เป็นร่าง",
      );
    }
    const steps = normalizeSteps(cur.draft_content?.steps);
    if (steps.length === 0) throw new Error("ต้องมีอย่างน้อย 1 ขั้นตอนก่อนส่งตรวจ");
    const untitled = steps.findIndex((s) => !s.title.trim());
    if (untitled >= 0) throw new Error(`ขั้นตอนที่ ${untitled + 1} ยังไม่มีชื่อ`);

    const { data: rows, error } = await db()
      .from("wi_documents")
      .update({
        status: "pending_review",
        submitted_by_name: data.actor,
        submitted_at: new Date().toISOString(),
        pending_change_summary: data.change_summary || null,
        updated_by_name: data.actor,
      })
      .eq("id", data.id)
      .eq("status", "draft")
      .select("id");
    if (error) fail(error, "ส่งตรวจไม่สำเร็จ");
    if (!rows?.length) throw new Error("สถานะ WI เปลี่ยนไปแล้ว — โหลดหน้าใหม่");
    await db()
      .from("wi_reviews")
      .insert({
        wi_id: data.id,
        outcome: "submitted",
        comment: data.change_summary || null,
        actor_name: data.actor,
      });
    await logActivity(data.id, "submitted", data.actor, {
      change_summary: data.change_summary || null,
    });
    return { ok: true };
  });

export const wiWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, actor: actorStr, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await db()
      .from("wi_documents")
      .update({ status: "draft", updated_by_name: data.actor })
      .eq("id", data.id)
      .eq("status", "pending_review")
      .select("id");
    if (error) fail(error, "ถอนคำขอไม่สำเร็จ");
    if (!rows?.length) throw new Error("WI ไม่ได้อยู่ในสถานะรอตรวจแล้ว");
    await logActivity(data.id, "updated", data.actor, { withdrawn: true });
    return { ok: true };
  });

export const wiApprove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        reviewToken: tokenStr,
        reviewer: actorStr,
        id: uuid,
        bump: z.enum(["major", "minor"]),
        comment: z.string().trim().max(1000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertReviewer(data.reviewToken);
    const { data: res, error } = await db().rpc("wi_publish", {
      p_wi_id: data.id,
      p_bump: data.bump,
      p_reviewer: data.reviewer,
      p_comment: data.comment,
    });
    if (error) {
      if (error.message.includes("reviewer must differ")) {
        throw new Error("ผู้อนุมัติต้องไม่ใช่คนเดียวกับผู้ส่งตรวจ");
      }
      if (error.message.includes("pending review")) throw new Error("WI ต้องอยู่ในสถานะรอตรวจก่อน");
      fail(error, "อนุมัติไม่สำเร็จ");
    }
    const r = res as { version_id: string; major: number; minor: number };
    return { ok: true, version: `v${r.major}.${r.minor}` };
  });

export const wiRequestChanges = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        reviewToken: tokenStr,
        reviewer: actorStr,
        id: uuid,
        comment: z.string().trim().min(1, "กรอกเหตุผลที่ต้องแก้ไข").max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertReviewer(data.reviewToken);
    const { data: rows, error } = await db()
      .from("wi_documents")
      .update({ status: "draft", updated_by_name: data.reviewer })
      .eq("id", data.id)
      .eq("status", "pending_review")
      .select("id");
    if (error) fail(error, "ส่งกลับแก้ไขไม่สำเร็จ");
    if (!rows?.length) throw new Error("WI ไม่ได้อยู่ในสถานะรอตรวจแล้ว");
    await db().from("wi_reviews").insert({
      wi_id: data.id,
      outcome: "changes_requested",
      comment: data.comment,
      actor_name: data.reviewer,
    });
    await logActivity(data.id, "changes_requested", data.reviewer, { comment: data.comment });
    return { ok: true };
  });

export const wiArchive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, actor: actorStr, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await db()
      .from("wi_documents")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        updated_by_name: data.actor,
      })
      .eq("id", data.id)
      .neq("status", "archived")
      .select("id");
    if (error) fail(error, "เก็บถาวรไม่สำเร็จ");
    if (!rows?.length) throw new Error("WI นี้ถูกเก็บถาวรอยู่แล้ว");
    await logActivity(data.id, "archived", data.actor);
    return { ok: true };
  });

export const wiRestore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, actor: actorStr, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const cur = await loadDoc(data.id);
    if (cur.status !== "archived") throw new Error("WI นี้ไม่ได้ถูกเก็บถาวร");
    const status: WiStatus =
      cur.current_version_id && !cur.has_unpublished_changes ? "published" : "draft";
    const { error } = await db()
      .from("wi_documents")
      .update({ status, archived_at: null, updated_by_name: data.actor })
      .eq("id", data.id)
      .eq("status", "archived");
    if (error) fail(error, "กู้คืนไม่สำเร็จ");
    await logActivity(data.id, "restored", data.actor, { status });
    return { ok: true, status };
  });

// ---- Versions --------------------------------------------------------------

export const wiGetVersion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, version_id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: v, error } = await db()
      .from("wi_versions")
      .select(`${VERSION_COLS}, content_snapshot`)
      .eq("id", data.version_id)
      .maybeSingle();
    if (error) fail(error, "โหลดเวอร์ชันไม่สำเร็จ");
    if (!v) throw new Error("ไม่พบเวอร์ชัน");
    const row = v as WiVersionRow & { content_snapshot: unknown };
    const snapshot = normalizeSnapshot(row.content_snapshot);
    return {
      version: {
        id: row.id,
        wi_id: row.wi_id,
        major: row.major,
        minor: row.minor,
        change_summary: row.change_summary,
        editor_name: row.editor_name,
        reviewer_name: row.reviewer_name,
        published_at: row.published_at,
      } satisfies WiVersionRow,
      snapshot,
      mediaUrls: await signPaths(collectMediaPaths(snapshot.steps)),
    };
  });

export const wiRestoreVersion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, actor: actorStr, id: uuid, version_id: uuid }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const cur = await loadDoc(data.id);
    if (cur.status === "pending_review") throw new Error("WI อยู่ระหว่างรอตรวจ — ถอนคำขอก่อน");
    if (cur.status === "archived") throw new Error("WI นี้ถูกเก็บถาวร — กู้คืนก่อน");
    const { data: v, error: vErr } = await db()
      .from("wi_versions")
      .select("id, wi_id, major, minor, content_snapshot")
      .eq("id", data.version_id)
      .eq("wi_id", data.id)
      .maybeSingle();
    if (vErr) fail(vErr);
    if (!v) throw new Error("ไม่พบเวอร์ชัน");
    const s = normalizeSnapshot((v as { content_snapshot: unknown }).content_snapshot);
    const { error } = await db()
      .from("wi_documents")
      .update({
        title: s.title || cur.title,
        description: s.description,
        owner_name: s.owner_name,
        tags: s.tags,
        est_minutes: s.est_minutes,
        equipment: s.equipment,
        safety_notes: s.safety_notes,
        related_docs: s.related_docs,
        draft_content: { steps: s.steps, translations: s.translations },
        status: "draft",
        has_unpublished_changes: true,
        updated_by_name: data.actor,
      })
      .eq("id", data.id);
    if (error) fail(error, "นำเวอร์ชันเดิมกลับมาไม่สำเร็จ");
    const label = `v${(v as { major: number }).major}.${(v as { minor: number }).minor}`;
    await logActivity(data.id, "updated", data.actor, { restored_from_version: label });
    return { ok: true };
  });

export const wiVersionsFeed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        page: z.number().int().min(1).max(10_000).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const from = (data.page - 1) * data.pageSize;
    const {
      data: rows,
      count,
      error,
    } = await db()
      .from("wi_versions")
      .select(VERSION_COLS, { count: "exact" })
      .order("published_at", { ascending: false })
      .range(from, from + data.pageSize - 1);
    if (error) fail(error, "โหลดประวัติเวอร์ชันไม่สำเร็จ");
    const list = (rows ?? []) as WiVersionRow[];
    const ids = Array.from(new Set(list.map((r) => r.wi_id)));
    const docs: Record<
      string,
      { wi_code: string; title: string; current_version_id: string | null }
    > = {};
    if (ids.length) {
      const { data: d, error: e } = await db()
        .from("wi_documents")
        .select("id, wi_code, title, current_version_id")
        .in("id", ids);
      if (e) fail(e);
      for (const r of (d ?? []) as {
        id: string;
        wi_code: string;
        title: string;
        current_version_id: string | null;
      }[])
        docs[r.id] = r;
    }
    return {
      rows: list.map((r) => ({
        ...r,
        wi_code: docs[r.wi_id]?.wi_code ?? "—",
        title: docs[r.wi_id]?.title ?? "—",
        is_current: docs[r.wi_id]?.current_version_id === r.id,
      })),
      total: count ?? 0,
    };
  });

// ---- Categories ------------------------------------------------------------

export const wiCategoriesList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const [cats, usage] = await Promise.all([
      db()
        .from("wi_categories")
        .select("id, name, description, sort_order, is_active, created_at, updated_at")
        .order("sort_order")
        .order("name"),
      db().from("wi_documents").select("category_id").not("category_id", "is", null).limit(10_000),
    ]);
    if (cats.error) fail(cats.error, "โหลดหมวดหมู่ไม่สำเร็จ");
    if (usage.error) fail(usage.error);
    const counts: Record<string, number> = {};
    for (const r of (usage.data ?? []) as { category_id: string }[]) {
      counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
    }
    return {
      rows: ((cats.data ?? []) as WiCategoryRow[]).map((c) => ({
        ...c,
        wi_count: counts[c.id] ?? 0,
      })),
    };
  });

export const wiCategoryUpsert = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        actor: actorStr,
        id: uuid.optional(),
        name: z.string().trim().min(1, "กรอกชื่อหมวด").max(120),
        description: z.string().trim().max(500).default(""),
        sort_order: z.number().int().min(0).max(100_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const fields = {
      name: data.name,
      description: data.description || null,
      sort_order: data.sort_order,
      updated_by_name: data.actor,
    };
    const { error } = data.id
      ? await db().from("wi_categories").update(fields).eq("id", data.id)
      : await db()
          .from("wi_categories")
          .insert({ ...fields, created_by_name: data.actor });
    if (error) {
      if (error.code === "23505") throw new Error("มีหมวดชื่อนี้อยู่แล้ว");
      fail(error, "บันทึกหมวดไม่สำเร็จ");
    }
    return { ok: true };
  });

export const wiCategorySetActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, actor: actorStr, id: uuid, is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await db()
      .from("wi_categories")
      .update({ is_active: data.is_active, updated_by_name: data.actor })
      .eq("id", data.id);
    if (error) fail(error, "อัปเดตหมวดไม่สำเร็จ");
    return { ok: true };
  });

export const wiCategoryDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { count, error: cErr } = await db()
      .from("wi_documents")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if (cErr) fail(cErr);
    if ((count ?? 0) > 0) {
      throw new Error(`ยังมี WI ใช้หมวดนี้ ${count} รายการ — ใช้ "เก็บถาวร" แทนการลบ`);
    }
    const { error } = await db().from("wi_categories").delete().eq("id", data.id);
    if (error) fail(error, "ลบหมวดไม่สำเร็จ");
    return { ok: true };
  });

// ---- Production links ------------------------------------------------------

export const wiLinkAdd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        actor: actorStr,
        wi_id: uuid,
        step_id: uuid,
        category_id: uuid.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const doc = await loadDoc(data.wi_id);
    if (doc.status === "archived") throw new Error("WI ที่เก็บถาวรผูกกับงานผลิตไม่ได้");
    const [step, cat] = await Promise.all([
      db().from("steps").select("id, step_name").eq("id", data.step_id).maybeSingle(),
      data.category_id
        ? db().from("categories").select("id, name").eq("id", data.category_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (step.error || !step.data) throw new Error("ไม่พบขั้นตอนการผลิต");
    if (data.category_id && (cat.error || !cat.data)) throw new Error("ไม่พบหมวดสินค้า");
    const { error } = await db().from("wi_production_links").insert({
      wi_id: data.wi_id,
      step_id: data.step_id,
      category_id: data.category_id,
      created_by_name: data.actor,
    });
    if (error) {
      if (error.code === "23505") throw new Error("ผูกขั้นตอนนี้ไว้แล้ว");
      fail(error, "ผูกงานผลิตไม่สำเร็จ");
    }
    await logActivity(data.wi_id, "linked", data.actor, {
      step_name: (step.data as { step_name: string }).step_name,
      category_name: (cat.data as { name: string } | null)?.name ?? null,
    });
    return { ok: true };
  });

export const wiLinkRemove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, actor: actorStr, wi_id: uuid, link_id: uuid }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await db()
      .from("wi_production_links")
      .delete()
      .eq("id", data.link_id)
      .eq("wi_id", data.wi_id)
      .select("id");
    if (error) fail(error, "ยกเลิกการผูกไม่สำเร็จ");
    if (rows?.length) await logActivity(data.wi_id, "unlinked", data.actor);
    return { ok: true };
  });

// ---- Media -----------------------------------------------------------------

export const wiCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        wi_id: uuid,
        ext: z.enum([...IMAGE_EXT, ...VIDEO_EXT]),
        sizeBytes: z.number().int().min(1).max(MAX_VIDEO_BYTES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const isImage = (IMAGE_EXT as readonly string[]).includes(data.ext);
    if (isImage && data.sizeBytes > MAX_IMAGE_BYTES) throw new Error("รูปภาพต้องไม่เกิน 10MB");
    const { data: exists, error: eErr } = await db()
      .from("wi_documents")
      .select("id")
      .eq("id", data.wi_id)
      .maybeSingle();
    if (eErr) fail(eErr);
    if (!exists) throw new Error("ไม่พบ WI");
    const path = `${SUPABASE_SCHEMA}/wi/${data.wi_id}/${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) fail(error, "สร้างลิงก์อัปโหลดไม่สำเร็จ");
    return {
      path,
      signedUrl: signed.signedUrl,
      contentType: MIME_BY_EXT[data.ext],
      kind: isImage ? ("image" as const) : ("video" as const),
    };
  });

export const wiSignMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, paths: z.array(z.string().max(300)).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    return { urlMap: await signPaths(data.paths) };
  });

// ---- Public (employee) -----------------------------------------------------

/** Read state of one employee for the live version of each WI. */
export type WiReadStatus = "none" | "viewed" | "read" | "outdated";
export type WiMyRead = { status: WiReadStatus; acknowledged_at: string | null };

async function readStatusFor(
  employeeId: string | null | undefined,
  docs: { id: string; current_version_id: string }[],
): Promise<Map<string, WiMyRead>> {
  const out = new Map<string, WiMyRead>();
  if (!employeeId || docs.length === 0) return out;
  const { data, error } = await db()
    .from("wi_reads")
    .select("wi_id, version_id, acknowledged_at")
    .eq("employee_id", employeeId)
    .in(
      "wi_id",
      docs.map((d) => d.id),
    )
    .limit(1000);
  if (error) fail(error, "โหลดสถานะการอ่านไม่สำเร็จ");
  const rows = (data ?? []) as {
    wi_id: string;
    version_id: string;
    acknowledged_at: string | null;
  }[];
  for (const doc of docs) {
    const mine = rows.filter((r) => r.wi_id === doc.id);
    const current = mine.find((r) => r.version_id === doc.current_version_id);
    if (current?.acknowledged_at) {
      out.set(doc.id, { status: "read", acknowledged_at: current.acknowledged_at });
    } else if (mine.some((r) => r.version_id !== doc.current_version_id && r.acknowledged_at)) {
      out.set(doc.id, { status: "outdated", acknowledged_at: null });
    } else if (current) {
      out.set(doc.id, { status: "viewed", acknowledged_at: null });
    } else {
      out.set(doc.id, { status: "none", acknowledged_at: null });
    }
  }
  return out;
}

const optionalEmployee = uuid.nullable().optional();

export const wiPublicForStep = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ step_id: uuid, category_id: uuid.nullable(), employee_id: optionalEmployee })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: links, error } = await db()
      .from("wi_production_links")
      .select("wi_id, category_id")
      .eq("step_id", data.step_id)
      .limit(50);
    if (error) fail(error, "โหลดคู่มือไม่สำเร็จ");
    const ids = Array.from(
      new Set(
        ((links ?? []) as { wi_id: string; category_id: string | null }[])
          .filter((l) => l.category_id == null || l.category_id === data.category_id)
          .map((l) => l.wi_id),
      ),
    );
    if (ids.length === 0) return { items: [] };
    const { data: docs, error: dErr } = await db()
      .from("wi_documents")
      .select("id, wi_code, title, current_version_id")
      .in("id", ids)
      .not("current_version_id", "is", null)
      .neq("status", "archived")
      .order("wi_code");
    if (dErr) fail(dErr, "โหลดคู่มือไม่สำเร็จ");
    const list = (docs ?? []) as {
      id: string;
      wi_code: string;
      title: string;
      current_version_id: string;
    }[];
    const [vers, reads] = await Promise.all([
      versionsById(list.map((d) => d.current_version_id)),
      readStatusFor(data.employee_id, list),
    ]);
    return {
      items: list.map((d) => {
        const v = vers[d.current_version_id];
        return {
          code: d.wi_code,
          title: d.title,
          version: v ? `v${v.major}.${v.minor}` : null,
          read_status: reads.get(d.id)?.status ?? ("none" as WiReadStatus),
        };
      }),
    };
  });

const wiCodeStr = z.string().regex(/^WI-\d{4,8}$/, "รหัส WI ไม่ถูกต้อง");

export const wiPublicGet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: wiCodeStr, employee_id: optionalEmployee }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: doc, error } = await db()
      .from("wi_documents")
      .select("id, status, current_version_id")
      .eq("wi_code", data.code)
      .maybeSingle();
    if (error) fail(error, "โหลดคู่มือไม่สำเร็จ");
    const d = doc as { id: string; status: WiStatus; current_version_id: string | null } | null;
    if (!d || !d.current_version_id || d.status === "archived") return { found: false as const };
    const { data: v, error: vErr } = await db()
      .from("wi_versions")
      .select("major, minor, published_at, content_snapshot, editor_name, reviewer_name")
      .eq("id", d.current_version_id)
      .maybeSingle();
    if (vErr) fail(vErr, "โหลดคู่มือไม่สำเร็จ");
    if (!v) return { found: false as const };
    const row = v as {
      major: number;
      minor: number;
      published_at: string;
      content_snapshot: unknown;
      editor_name: string | null;
      reviewer_name: string | null;
    };
    const snapshot = normalizeSnapshot(row.content_snapshot);
    const [mediaUrls, reads] = await Promise.all([
      signPaths(collectMediaPaths(snapshot.steps)),
      readStatusFor(data.employee_id, [{ id: d.id, current_version_id: d.current_version_id }]),
    ]);
    return {
      found: true as const,
      version: `v${row.major}.${row.minor}`,
      published_at: row.published_at,
      editor_name: row.editor_name,
      reviewer_name: row.reviewer_name,
      snapshot,
      mediaUrls,
      my_read: reads.get(d.id) ?? null,
    };
  });

/**
 * Employee opened (or confirmed) the live version. Public like the scan page:
 * the employee picks their own name, so this is a reading log, not a signature.
 */
export const wiPublicRecordRead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: wiCodeStr,
        employee_id: uuid,
        acknowledge: z.boolean().default(false),
        lang: z.enum(["th", "en", "my"]).default("th"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const [docRes, empRes] = await Promise.all([
      db()
        .from("wi_documents")
        .select("id, status, current_version_id")
        .eq("wi_code", data.code)
        .maybeSingle(),
      db()
        .from("employees")
        .select("id")
        .eq("id", data.employee_id)
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (docRes.error) fail(docRes.error, "บันทึกการอ่านไม่สำเร็จ");
    if (empRes.error) fail(empRes.error, "บันทึกการอ่านไม่สำเร็จ");
    const doc = docRes.data as {
      id: string;
      status: WiStatus;
      current_version_id: string | null;
    } | null;
    if (!doc || !doc.current_version_id || doc.status === "archived") {
      throw new Error("คู่มือนี้ไม่พร้อมใช้งานแล้ว");
    }
    if (!empRes.data) throw new Error("ไม่พบพนักงาน — เลือกชื่อใหม่อีกครั้ง");
    const { data: res, error } = await db().rpc("wi_record_read", {
      p_wi_id: doc.id,
      p_version_id: doc.current_version_id,
      p_employee_id: data.employee_id,
      p_acknowledge: data.acknowledge,
      p_lang: data.lang,
    });
    if (error) fail(error, "บันทึกการอ่านไม่สำเร็จ");
    const r = res as { acknowledged_at: string | null } | null;
    const myRead: WiMyRead = r?.acknowledged_at
      ? { status: "read", acknowledged_at: r.acknowledged_at }
      : { status: "viewed", acknowledged_at: null };
    return { my_read: myRead };
  });

// ---- Admin: who has read the live version ---------------------------------

export type WiReaderRow = {
  employee_id: string;
  name: string;
  emp_code: string | null;
  nationality: string | null;
  status: WiReadStatus;
  view_count: number;
  last_viewed_at: string | null;
  acknowledged_at: string | null;
  lang: string | null;
};

export const wiReadersList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, wi_id: uuid }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const doc = await loadDoc(data.wi_id);
    const [empRes, readRes] = await Promise.all([
      db()
        .from("employees")
        .select("id, name, emp_code, nationality")
        .eq("active", true)
        .order("name")
        .limit(1000),
      db()
        .from("wi_reads")
        .select("version_id, employee_id, view_count, last_viewed_at, acknowledged_at, lang")
        .eq("wi_id", doc.id)
        .limit(5000),
    ]);
    if (empRes.error) fail(empRes.error, "โหลดรายชื่อไม่สำเร็จ");
    if (readRes.error) fail(readRes.error, "โหลดการอ่านไม่สำเร็จ");
    const reads = (readRes.data ?? []) as {
      version_id: string;
      employee_id: string;
      view_count: number;
      last_viewed_at: string;
      acknowledged_at: string | null;
      lang: string;
    }[];
    const live = doc.current_version_id;
    const rows: WiReaderRow[] = (
      (empRes.data ?? []) as {
        id: string;
        name: string;
        emp_code: string | null;
        nationality: string | null;
      }[]
    ).map((emp) => {
      const mine = reads.filter((r) => r.employee_id === emp.id);
      const current = live ? mine.find((r) => r.version_id === live) : undefined;
      const status: WiReadStatus = current?.acknowledged_at
        ? "read"
        : mine.some((r) => r.version_id !== live && r.acknowledged_at)
          ? "outdated"
          : current
            ? "viewed"
            : "none";
      return {
        employee_id: emp.id,
        name: emp.name,
        emp_code: emp.emp_code,
        nationality: emp.nationality,
        status,
        view_count: current?.view_count ?? 0,
        last_viewed_at: current?.last_viewed_at ?? null,
        acknowledged_at: current?.acknowledged_at ?? null,
        lang: current?.lang ?? null,
      };
    });
    return { live_version_id: live, rows };
  });

// ---- Admin: AI draft translation -------------------------------------------

const translateSourceSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(2000),
  equipment: z.string().max(2000),
  safety_notes: z.string().max(4000),
  steps: z
    .array(
      z.object({
        id: z.string().max(64),
        title: z.string().max(200),
        instructions: z.string().max(10_000),
        note: z.string().max(2000),
        warning: z.string().max(2000),
        expected_result: z.string().max(2000),
        checkpoints: z
          .array(
            z.object({
              id: z.string().max(64),
              label: z.string().max(200),
              criteria: z.string().max(500),
            }),
          )
          .max(10),
      }),
    )
    .max(100),
});

const LANG_NAME = { en: "English", my: "Burmese (Myanmar, Unicode script)" } as const;

export const wiAiTranslate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ token: tokenStr, lang: z.enum(["en", "my"]), source: translateSourceSchema })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const system =
      `You translate factory work instructions for a Thai curtain and blinds factory from Thai to ${LANG_NAME[data.lang]}. ` +
      "Readers are shop-floor workers: use short, plain sentences and everyday words. " +
      "Keep numbers, units (cm, mm, m), product codes and list numbering exactly as written. " +
      "Return JSON only, with the same keys and ids as the input. Translate every non-empty string; keep empty strings empty.";
    const res = await aiChatCompletions(
      {
        model: flashModelId(),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(data.source) },
        ],
      },
      { appSlug: APP_SLUG, feature: "wi_translate", userLabel: `wi:${data.lang}` },
    );
    if (res.status === 429) throw new Error("AI ใช้งานถี่เกินไป — รอสักครู่แล้วลองใหม่");
    if (!res.ok) throw new Error("AI แปลไม่สำเร็จ — ลองใหม่อีกครั้ง");
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    let parsed: z.infer<typeof translateSourceSchema>;
    try {
      parsed = translateSourceSchema.parse(JSON.parse(text.replace(/^```(?:json)?|```$/g, "")));
    } catch {
      throw new Error("AI ตอบกลับในรูปแบบที่อ่านไม่ได้ — ลองใหม่อีกครั้ง");
    }
    const translation: WiTranslation = wiTranslationSchema.parse({
      title: parsed.title,
      description: parsed.description,
      equipment: parsed.equipment,
      safety_notes: parsed.safety_notes,
      steps: Object.fromEntries(
        parsed.steps.map((s) => [
          s.id,
          {
            title: s.title,
            instructions: s.instructions,
            note: s.note,
            warning: s.warning,
            expected_result: s.expected_result,
            checkpoints: Object.fromEntries(
              s.checkpoints.map((c) => [c.id, { label: c.label, criteria: c.criteria }]),
            ),
          },
        ]),
      ),
    });
    return { translation };
  });

// Production steps have no sort column. This order matches the shop-floor
// sequence (cut → sew → assemble) so the employee catalog reads top to bottom.
const STEP_RANK = [
  "ตั้งงาน",
  "ตัดผ้า",
  "ตัดเทปผ้า",
  "ตัดใบ",
  "ตัดราง",
  "ตัดอลู",
  "เจาะใบ",
  "เจาะราง",
  "เจาะถ่วง",
  "เย็บเทป",
  "เตรียมโซ่",
  "ประกอบใบ",
  "ประกอบม่าน",
  "ประกอบมู่",
  "ประกอบราง",
  "ประกอบอลู",
  "บังราง",
  "เก็บสี",
];

function stepRank(name: string) {
  const i = STEP_RANK.findIndex((prefix) => name.startsWith(prefix));
  return i === -1 ? 1000 : i;
}

function firstImagePath(snapshot: WiSnapshot): string | null {
  for (const step of snapshot.steps) {
    for (const media of step.media) {
      if (media.type === "image" && media.path) return media.path;
    }
  }
  return null;
}

export type WiCatalogCategory = {
  id: string;
  name: string;
  wi_count: number;
  unread_count: number;
};
export type WiCatalogItem = {
  code: string;
  title: string;
  description: string | null;
  version: string | null;
  est_minutes: number | null;
  cover_url: string | null;
  read_status: WiReadStatus;
};
export type WiCatalogStep = { step_id: string; step_name: string; items: WiCatalogItem[] };

export const wiPublicCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        category_id: z.string().uuid().nullable(),
        employee_id: optionalEmployee,
        lang: z.enum(["th", "en", "my"]).default("th"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const [catRes, linkRes, docRes] = await Promise.all([
      db().from("categories").select("id, name").eq("active", true),
      db().from("wi_production_links").select("wi_id, step_id, category_id").limit(500),
      db()
        .from("wi_documents")
        .select("id, wi_code, title, description, est_minutes, current_version_id, status")
        .not("current_version_id", "is", null)
        .neq("status", "archived")
        .limit(200),
    ]);
    if (catRes.error) fail(catRes.error, "โหลดหมวดสินค้าไม่สำเร็จ");
    if (linkRes.error) fail(linkRes.error, "โหลดคู่มือไม่สำเร็จ");
    if (docRes.error) fail(docRes.error, "โหลดคู่มือไม่สำเร็จ");

    const docs = (docRes.data ?? []) as {
      id: string;
      wi_code: string;
      title: string;
      description: string | null;
      est_minutes: number | null;
      current_version_id: string;
      status: string;
    }[];
    const docById = new Map(docs.map((doc) => [doc.id, doc]));
    const links = (
      (linkRes.data ?? []) as { wi_id: string; step_id: string; category_id: string | null }[]
    ).filter((link) => link.category_id && docById.has(link.wi_id));

    const wiIdsByCategory = new Map<string, Set<string>>();
    for (const link of links) {
      const set = wiIdsByCategory.get(link.category_id!) ?? new Set<string>();
      set.add(link.wi_id);
      wiIdsByCategory.set(link.category_id!, set);
    }
    const linkedDocs = Array.from(new Set(links.map((link) => link.wi_id))).map((id) =>
      docById.get(id)!,
    );
    const reads = await readStatusFor(data.employee_id, linkedDocs);
    const isUnread = (wiId: string) => {
      const status = reads.get(wiId)?.status;
      return status !== undefined && status !== "read";
    };

    const categories: WiCatalogCategory[] = ((catRes.data ?? []) as { id: string; name: string }[])
      .map((cat) => {
        const ids = Array.from(wiIdsByCategory.get(cat.id) ?? []);
        return {
          id: cat.id,
          name: cat.name,
          wi_count: ids.length,
          unread_count: ids.filter(isUnread).length,
        };
      })
      .sort((a, b) => {
        const na = Number(a.name.match(/^(\d+)/)?.[1] ?? 99);
        const nb = Number(b.name.match(/^(\d+)/)?.[1] ?? 99);
        return na - nb || a.name.localeCompare(b.name, "th");
      });

    const chosenLinks = data.category_id
      ? links.filter((link) => link.category_id === data.category_id)
      : [];
    if (chosenLinks.length === 0) return { categories, steps: [] as WiCatalogStep[] };

    const stepIds = Array.from(new Set(chosenLinks.map((link) => link.step_id)));
    const versionIds = Array.from(
      new Set(chosenLinks.map((link) => docById.get(link.wi_id)!.current_version_id)),
    );
    const [stepRes, verRes] = await Promise.all([
      db().from("steps").select("id, step_name").in("id", stepIds),
      db().from("wi_versions").select("id, major, minor, content_snapshot").in("id", versionIds),
    ]);
    if (stepRes.error) fail(stepRes.error, "โหลดขั้นตอนไม่สำเร็จ");
    if (verRes.error) fail(verRes.error, "โหลดคู่มือไม่สำเร็จ");

    const stepName = new Map(
      ((stepRes.data ?? []) as { id: string; step_name: string }[]).map((step) => [
        step.id,
        step.step_name,
      ]),
    );
    const versionById = new Map(
      (
        (verRes.data ?? []) as {
          id: string;
          major: number;
          minor: number;
          content_snapshot: unknown;
        }[]
      ).map((version) => [version.id, version]),
    );

    const coverByWi = new Map<string, string | null>();
    const snapshotByWi = new Map<string, WiSnapshot>();
    for (const link of chosenLinks) {
      if (coverByWi.has(link.wi_id)) continue;
      const doc = docById.get(link.wi_id)!;
      const version = versionById.get(doc.current_version_id);
      const snapshot = version ? normalizeSnapshot(version.content_snapshot) : null;
      if (snapshot) snapshotByWi.set(link.wi_id, localizeSnapshot(snapshot, data.lang).snapshot);
      coverByWi.set(link.wi_id, snapshot ? firstImagePath(snapshot) : null);
    }
    const urls = await signPaths(
      Array.from(coverByWi.values()).filter((path): path is string => !!path),
    );

    const grouped = new Map<string, WiCatalogItem[]>();
    const seen = new Set<string>();
    for (const link of chosenLinks) {
      const key = `${link.step_id}:${link.wi_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const doc = docById.get(link.wi_id)!;
      const version = versionById.get(doc.current_version_id);
      const cover = coverByWi.get(link.wi_id);
      const live = snapshotByWi.get(link.wi_id);
      const item: WiCatalogItem = {
        code: doc.wi_code,
        title: live?.title || doc.title,
        description: live ? live.description : doc.description,
        version: version ? `v${version.major}.${version.minor}` : null,
        est_minutes: live?.est_minutes ?? null,
        cover_url: cover ? (urls[cover] ?? null) : null,
        read_status: reads.get(link.wi_id)?.status ?? "none",
      };
      const list = grouped.get(link.step_id) ?? [];
      list.push(item);
      grouped.set(link.step_id, list);
    }

    const steps: WiCatalogStep[] = Array.from(grouped.entries())
      .map(([step_id, items]) => ({
        step_id,
        step_name: stepName.get(step_id) ?? "ขั้นตอน",
        items: items.sort((a, b) => a.code.localeCompare(b.code)),
      }))
      .sort(
        (a, b) =>
          stepRank(a.step_name) - stepRank(b.step_name) ||
          a.step_name.localeCompare(b.step_name, "th"),
      );

    return { categories, steps };
  });
