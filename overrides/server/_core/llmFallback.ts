import { invokeLLM, invokeNvidiaLLM, type InvokeParams, type InvokeResult } from "./llm";

export function isPrimaryProviderFallbackEligible(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /AI_API_KEY is not configured/i.test(message)
    || /LLM invoke failed:\s*402\b/i.test(message)
    || /insufficient[_\s-]?(?:credits?|quota|balance)|out of credits|not enough credits|credit balance.{0,40}(?:low|insufficient|exhausted)|quota.{0,30}(?:exceeded|exhausted)|openrouter_credits|payment required/i.test(message);
}

function contentAsText(content: InvokeResult["choices"][number]["message"]["content"]): string {
  if (typeof content === "string") return content;
  return content.map(part => ("text" in part && typeof part.text === "string") ? part.text : "").join("\n");
}

/** Primary-first shared fallback for free-form assistant responses. */
export async function invokeLLMWithNvidiaFallback(params: InvokeParams): Promise<InvokeResult> {
  let primary: InvokeResult;
  try {
    primary = await invokeLLM(params);
  } catch (error) {
    if (!isPrimaryProviderFallbackEligible(error)) throw error;
    console.warn("[StudyFlow AI] Primary provider credentials or quota unavailable; invoking NVIDIA fallback.");
    return invokeNvidiaLLM({ ...params, model: undefined });
  }

  const choice = primary.choices?.[0];
  const content = contentAsText(choice?.message?.content ?? "");
  if (!content.trim() || choice?.finish_reason === "length") {
    console.warn("[StudyFlow AI] Primary provider returned an empty or truncated response; invoking NVIDIA fallback.", {
      model: primary.model || null,
      finishReason: choice?.finish_reason ?? null,
      completionTokens: primary.usage?.completion_tokens ?? null,
      contentLength: content.length,
    });
    return invokeNvidiaLLM({ ...params, model: undefined });
  }

  return primary;
}
