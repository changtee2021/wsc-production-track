// Public endpoint for Curtain Flow → WSC Production Track.
// Receives approved production jobs (stock-checked) and upserts them
// into production_jobs by job_no (idempotent).
//
// Auth: X-API-Key header must equal CURTAIN_FLOW_API_KEY (timing-safe).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const jobSchema = z.object({
  job_no: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  order_no: z.string().trim().max(64).optional().nullable(),
  customer_name: z.string().trim().max(255).optional().nullable(),
  product_type: z.string().trim().max(64).optional().nullable(),
  width_cm: z.number().min(0).max(10000).optional().nullable(),
  height_cm: z.number().min(0).max(10000).optional().nullable(),
  side: z.enum(["L", "R"]).optional().nullable(),
  fabric_code: z.string().trim().max(64).optional().nullable(),
  rail_code: z.string().trim().max(64).optional().nullable(),
  color_code: z.string().trim().max(64).optional().nullable(),
  motor: z.string().trim().max(64).optional().nullable(),
  accessories: z.record(z.string(), z.any()).optional(),
  qty: z.number().int().min(1).max(9999).optional(),
  label_rev: z.string().trim().max(32).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  ship_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cancelled: z.boolean().optional(),
});

const bodySchema = z.object({
  jobs: z.array(jobSchema).min(1).max(500),
});

function isAuthorized(request: Request): boolean {
  const expected = process.env.CURTAIN_FLOW_API_KEY ?? "";
  if (!expected) return false;
  const got = request.headers.get("x-api-key") ?? "";
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/curtain-flow/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let parsed: z.infer<typeof bodySchema>;
        try {
          const raw = await request.json();
          parsed = bodySchema.parse(raw);
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Invalid body" },
            { status: 400 },
          );
        }

        const rows = parsed.jobs.map((j) => ({
          job_no: j.job_no,
          order_no: j.order_no ?? null,
          customer_name: j.customer_name ?? null,
          product_type: j.product_type ?? null,
          width_cm: j.width_cm ?? null,
          height_cm: j.height_cm ?? null,
          side: j.side ?? null,
          fabric_code: j.fabric_code ?? null,
          rail_code: j.rail_code ?? null,
          color_code: j.color_code ?? null,
          motor: j.motor ?? null,
          accessories: j.accessories ?? {},
          qty: j.qty ?? 1,
          label_rev: j.label_rev ?? null,
          due_date: j.due_date ?? null,
          ship_date: j.ship_date ?? null,
          status: j.cancelled ? "cancelled" : "pending",
          source: "curtain_flow",
          source_payload: j as never,
        }));

        const { data, error } = await supabaseAdmin
          .from("production_jobs")
          .upsert(rows, { onConflict: "job_no" })
          .select("id, job_no");

        if (error) {
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }

        return Response.json({
          ok: true,
          accepted: data?.length ?? 0,
          job_nos: (data ?? []).map((r) => r.job_no),
        });
      },
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const jobNo = url.searchParams.get("job_no");
        if (!jobNo) {
          return Response.json({ ok: false, error: "job_no required" }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
          .from("production_jobs")
          .select("job_no, order_no, status, printed_at, started_at, finished_at, updated_at")
          .eq("job_no", jobNo)
          .maybeSingle();
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!data) {
          return Response.json({ ok: false, error: "not found" }, { status: 404 });
        }
        return Response.json({ ok: true, job: data });
      },
    },
  },
});
