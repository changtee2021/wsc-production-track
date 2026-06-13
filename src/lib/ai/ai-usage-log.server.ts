import type { AiBackend } from "@/lib/ai/ai-provider.server";

export type AiUsageStatus = "ok" | "rate_limit" | "payment_required" | "error";

export type AiUsageLogInput = {
  appSlug: string;
  feature: string;
  userId?: string | null;
  userLabel?: string | null;
  routePath?: string | null;
  model: string;
  backend: AiBackend;
  inputTokens?: number;
  outputTokens?: number;
  status?: AiUsageStatus;
  latencyMs?: number;
  errorMessage?: string | null;
};

const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "google/gemini-3-flash-preview": { in: 0.5, out: 3 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-pro": { in: 1.25, out: 10 },
};

function estimateCostUsd(model: string, input: number, output: number): number {
  const p = PRICING[model] ?? PRICING["gemini-2.5-flash"];
  return (input * p.in + output * p.out) / 1_000_000;
}

export function httpStatusToAiStatus(status: number): AiUsageStatus {
  if (status === 429) return "rate_limit";
  if (status === 402) return "payment_required";
  if (status >= 400) return "error";
  return "ok";
}

export async function logAiUsageEvent(input: AiUsageLogInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    await supabaseAdmin.schema("infra").from("ai_usage_events").insert({
      app_slug: input.appSlug,
      user_id: input.userId ?? null,
      user_label: input.userLabel ?? null,
      feature: input.feature,
      route_path: input.routePath ?? null,
      model: input.model,
      backend: input.backend,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      estimated_cost_usd: estimateCostUsd(input.model, inputTokens, outputTokens),
      status: input.status ?? "ok",
      latency_ms: input.latencyMs ?? null,
      error_message: input.errorMessage ?? null,
    });
  } catch (e) {
    console.error("[ai-usage-log]", e);
  }
}

type UsageJson = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export async function logAiResponseFromJson(json: unknown, ctx: AiUsageLogInput): Promise<void> {
  const usage = (json as UsageJson).usage;
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
  await logAiUsageEvent({ ...ctx, inputTokens, outputTokens });
}

export type AiUsageMeta = {
  appSlug: string;
  feature: string;
  userId?: string | null;
  userLabel?: string | null;
  routePath?: string | null;
};
