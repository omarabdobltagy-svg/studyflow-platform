import { invokeLLM, invokeLLMStream, type InvokeParams, type InvokeResult } from "./llm";

/** Kept for legacy imports. Gemini is primary; invokeLLM owns OpenRouter failover. */
export async function invokeLLMWithNvidiaFallback(params: InvokeParams): Promise<InvokeResult> {
  return invokeLLM(params);
}

/** Streaming variant preserves partial-output safety in the Gemini/OpenRouter client. */
export async function invokeLLMWithNvidiaFallbackStream(
  params: InvokeParams,
  onToken: (token: string) => void,
): Promise<InvokeResult> {
  return invokeLLMStream(params, onToken);
}

/** Compatibility predicate for old callers; current provider failover is handled by invokeLLM. */
export function isPrimaryProviderFallbackEligible(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /GEMINI_API_KEY is not configured|Gemini invoke failed:\s*(?:400|401|402|403|404|408|409|425|429|5\d\d)\b|network|timed out|unsupported/i.test(message);
}
