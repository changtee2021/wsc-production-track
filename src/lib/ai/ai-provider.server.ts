/** Dual AI backend: GEMINI_API_KEY (preferred) or LOVABLE_API_KEY (fallback). */

import {
  httpStatusToAiStatus,
  logAiResponseFromJson,
  logAiUsageEvent,
  type AiUsageMeta,
} from "@/lib/ai/ai-usage-log.server";

export type AiBackend = "gemini" | "lovable";

export type { AiUsageMeta };

export function getAiBackend(): AiBackend {
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.LOVABLE_API_KEY?.trim()) return "lovable";
  throw new Error("ยังไม่ได้ตั้งค่า AI (GEMINI_API_KEY หรือ LOVABLE_API_KEY)");
}

/** Map Lovable-style model id → provider-specific id */
function normalizeModel(model: string, backend: AiBackend): string {
  if (backend === "lovable") return model;
  const m = model.replace(/^google\//, "");
  if (m.includes("gemini-2.5-pro")) return "gemini-2.5-pro";
  if (m.includes("gemini-3-flash") || m.includes("gemini-2.5-flash")) return "gemini-2.5-flash";
  return m;
}

export function flashModelId(): string {
  return getAiBackend() === "gemini" ? "gemini-2.5-flash" : "google/gemini-2.5-flash";
}

export function proModelId(): string {
  return getAiBackend() === "gemini" ? "gemini-2.5-pro" : "google/gemini-2.5-pro";
}

export async function aiChatCompletions(
  body: Record<string, unknown>,
  meta?: AiUsageMeta,
): Promise<Response> {
  const startMs = Date.now();
  const backend = getAiBackend();
  const model = normalizeModel(String(body.model ?? flashModelId()), backend);
  const payload = { ...body, model };

  const resp =
    backend === "gemini"
      ? await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GEMINI_API_KEY!.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      : await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LOVABLE_API_KEY!.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

  if (meta) {
    const latencyMs = Date.now() - startMs;
    const status = httpStatusToAiStatus(resp.status);
    if (!resp.ok) {
      void logAiUsageEvent({
        ...meta,
        model,
        backend,
        status,
        latencyMs,
        errorMessage: `HTTP ${resp.status}`,
      });
    } else {
      void resp
        .clone()
        .json()
        .then((json) =>
          logAiResponseFromJson(json, {
            ...meta,
            model,
            backend,
            status: "ok",
            latencyMs,
          }),
        )
        .catch(() => {});
    }
  }

  return resp;
}

export function throwOnAiHttpError(status: number): void {
  if (status === 429) throw new Error("RATE_LIMIT");
  if (status === 402) throw new Error("PAYMENT_REQUIRED");
}
