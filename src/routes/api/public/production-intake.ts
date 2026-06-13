// Public endpoint: wsc-backoffice forwards approved orders here.
// Auth: x-intake-signature = HMAC-SHA256(raw body, PRODUCTION_INTAKE_SECRET)
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const payloadSchema = z.object({
  source_order_id: z.string().uuid(),
  customer_name: z.string(),
  customer_code: z.string(),
  product_type: z.string(),
  width_cm: z.number(),
  height_cm: z.number(),
  color_code: z.string(),
  quantity: z.number().int().positive(),
  company_id: z.enum(["WP", "WSC"]),
  bom_template_id: z.string().uuid().nullable(),
  approved_at: z.string(),
});

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.PRODUCTION_INTAKE_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/production-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-intake-signature");
        if (!verifySignature(raw, sig)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(JSON.parse(raw));
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Invalid body" },
            { status: 400 },
          );
        }

        const jobNo = `BO-${payload.source_order_id}`;
        const row = {
          job_no: jobNo,
          order_no: payload.customer_code || null,
          customer_name: payload.customer_name || null,
          product_type: payload.product_type || null,
          width_cm: payload.width_cm,
          height_cm: payload.height_cm,
          color_code: payload.color_code || null,
          qty: payload.quantity,
          status: "pending" as const,
          source: "backoffice",
          source_payload: payload as never,
        };

        const { data, error } = await supabaseAdmin
          .from("production_jobs")
          .upsert(row, { onConflict: "job_no" })
          .select("id, job_no")
          .single();

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          id: data.id,
          job_id: data.job_no,
          ref: data.id,
        });
      },
    },
  },
});
