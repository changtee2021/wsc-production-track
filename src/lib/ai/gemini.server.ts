import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getAiBackend } from "@/lib/ai/ai-provider.server";

export function getFlashModel(): LanguageModel {
  if (getAiBackend() === "gemini") {
    return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY!.trim() })(
      "gemini-2.5-flash",
    );
  }
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": process.env.LOVABLE_API_KEY!.trim(),
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  return provider("google/gemini-2.5-flash");
}

export function getProModel(): LanguageModel {
  if (getAiBackend() === "gemini") {
    return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY!.trim() })(
      "gemini-2.5-pro",
    );
  }
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": process.env.LOVABLE_API_KEY!.trim(),
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  return provider("google/gemini-2.5-pro");
}
