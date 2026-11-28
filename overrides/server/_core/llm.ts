import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id, tool_calls } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const normalizedToolCalls = tool_calls?.length ? { tool_calls } : {};
  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // Preserve assistant tool calls even when the model returns no visible text.
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
      ...normalizedToolCalls,
    };
  }

  return {
    role,
    name,
    content: contentParts,
    ...normalizedToolCalls,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = (configuredBaseUrl: string, fallbackBaseUrl: string) => {
  const configured = configuredBaseUrl.trim() || fallbackBaseUrl;
  if (/\/chat\/completions\/?$/.test(configured)) return configured;
  return configured.replace(/\/+$/, "") + "/chat/completions";
};

const assertApiKey = (apiKey: string, variableName: string) => {
  if (!apiKey) throw new Error(variableName + " is not configured");
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Retries transient provider responses and network errors with exponential backoff.
// Deterministic 4xx responses return immediately for caller-side fallback/error handling.
const isRetryableStatus = (status: number) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const fetchWithBackoff = async (
  url: string,
  init: FetchInit
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      // A 429 caused by exhausted billing/quota is deterministic. Do not retry
      // it repeatedly; return it so the planner can switch providers.
      if (response.status === 429) {
        const errorPreview = await response.clone().text().catch(() => "");
        if (/insufficient[_\s-]?(?:credits?|quota|balance)|out of credits|credit balance|quota.{0,30}(?:exceeded|exhausted)|payment required/i.test(errorPreview)) {
          return response;
        }
      }
      // Authentication, billing, validation and unsupported-feature 4xx errors
      // are deterministic. Return them immediately so callers can react/fallback.
      if (response.ok || !isRetryableStatus(response.status) || attempt === RETRY_MAX_RETRIES) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after transient status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

type ProviderRequestConfig = {
  apiBaseUrl: string;
  fallbackBaseUrl: string;
  apiKey: string;
  apiKeyVariable: string;
  defaultModel: string;
  errorPrefix: string;
  omitResponseFormat?: boolean;
  pollPending?: boolean;
  additionalBody?: Record<string, unknown>;
};

const NVIDIA_POLL_INTERVAL_MS = 1_000;
const NVIDIA_POLL_TIMEOUT_MS = 90_000;

async function pollNvidiaPendingResponse(
  initialResponse: Response,
  provider: ProviderRequestConfig
): Promise<InvokeResult> {
  const initialPayload = await initialResponse.json().catch(() => ({})) as Record<string, unknown>;
  const requestId = [
    initialPayload.requestId,
    initialPayload.request_id,
    initialResponse.headers.get("NVCF-REQID"),
    initialResponse.headers.get("NVCF-REQUEST-ID"),
  ].find(value => typeof value === "string" && value.length > 0) as string | undefined;

  if (!requestId) {
    throw new Error(provider.errorPrefix + ": HTTP 202 returned without a requestId");
  }

  const statusBaseUrl = resolveApiUrl(provider.apiBaseUrl, provider.fallbackBaseUrl)
    .replace(/\/chat\/completions\/?$/i, "");
  const statusUrl = statusBaseUrl + "/status/" + encodeURIComponent(requestId);
  const deadline = Date.now() + NVIDIA_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(NVIDIA_POLL_INTERVAL_MS);
    const pollResponse = await fetchWithBackoff(statusUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
    });

    if (pollResponse.status === 202) {
      try {
        await pollResponse.body?.cancel();
      } catch {
        // The response body may already be consumed or closed.
      }
      continue;
    }

    if (!pollResponse.ok) {
      const errorText = (await pollResponse.text()).slice(0, 1_600);
      throw new Error(
        provider.errorPrefix + " status polling failed: " +
        pollResponse.status + " " + pollResponse.statusText + " – " + errorText
      );
    }

    const result = await pollResponse.json() as InvokeResult;
    if (!result || !Array.isArray(result.choices)) {
      throw new Error(provider.errorPrefix + ": status polling returned an invalid completion payload");
    }
    return result;
  }

  throw new Error(provider.errorPrefix + ": timed out while waiting for the pending request");
}

async function invokeWithProvider(
  params: InvokeParams,
  provider: ProviderRequestConfig
): Promise<InvokeResult> {
  assertApiKey(provider.apiKey, provider.apiKeyVariable);
  const {
    messages, tools, toolChoice, tool_choice, outputSchema, output_schema,
    responseFormat, response_format, model, thinking, reasoning, maxTokens, max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };
  const resolvedModel = model || provider.defaultModel;
  if (resolvedModel) payload.model = resolvedModel;
  if (tools && tools.length > 0) payload.tools = tools;

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") payload.max_tokens = resolvedMaxTokens;
  if (thinking) payload.thinking = thinking;
  if (reasoning) payload.reasoning = reasoning;

  // Nemotron supports JSON-object response mode. The planner additionally
  // validates the returned object against its Zod schema before saving.
  const normalizedResponseFormat = provider.omitResponseFormat
    ? undefined
    : normalizeResponseFormat({ responseFormat, response_format, outputSchema, output_schema });
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;
  if (provider.additionalBody) Object.assign(payload, provider.additionalBody);

  const response = await fetchWithBackoff(
    resolveApiUrl(provider.apiBaseUrl, provider.fallbackBaseUrl),
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
      body: JSON.stringify(payload),
    }
  );

  if (response.status === 202 && provider.pollPending) {
    return pollNvidiaPendingResponse(response, provider);
  }
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 1_600);
    throw new Error(
      provider.errorPrefix + ": " + response.status + " " + response.statusText + " – " + errorText
    );
  }
  return (await response.json()) as InvokeResult;
}

function extractTextContent(content: InvokeResult["choices"][number]["message"]["content"]): string {
  if (typeof content === "string") return content;
  return content.map(part => ("text" in part && typeof part.text === "string") ? part.text : "").join("");
}

function extractStreamDelta(payload: Record<string, any>): string {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  const value = choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(part => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "").join("");
  }
  return "";
}

async function streamWithProvider(
  params: InvokeParams,
  provider: ProviderRequestConfig,
  onToken: (token: string) => void,
): Promise<InvokeResult> {
  assertApiKey(provider.apiKey, provider.apiKeyVariable);
  const {
    messages, tools, toolChoice, tool_choice, outputSchema, output_schema,
    responseFormat, response_format, model, thinking, reasoning, maxTokens, max_tokens,
  } = params;
  const payload: Record<string, unknown> = { messages: messages.map(normalizeMessage) };
  const resolvedModel = model || provider.defaultModel;
  if (resolvedModel) payload.model = resolvedModel;
  if (tools && tools.length > 0) payload.tools = tools;
  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") payload.max_tokens = resolvedMaxTokens;
  if (thinking) payload.thinking = thinking;
  if (reasoning) payload.reasoning = reasoning;
  const normalizedResponseFormat = provider.omitResponseFormat
    ? undefined
    : normalizeResponseFormat({ responseFormat, response_format, outputSchema, output_schema });
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;
  if (provider.additionalBody) Object.assign(payload, provider.additionalBody);
  // Set after provider defaults so this endpoint always requests a streamed response.
  payload.stream = true;

  const response = await fetchWithBackoff(
    resolveApiUrl(provider.apiBaseUrl, provider.fallbackBaseUrl),
    {
      method: "POST",
      headers: {
        accept: "text/event-stream, application/json",
        "content-type": "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
      body: JSON.stringify(payload),
    },
  );

  if (response.status === 202 && provider.pollPending) {
    const completed = await pollNvidiaPendingResponse(response, provider);
    const content = extractTextContent(completed.choices?.[0]?.message?.content ?? "");
    if (content) onToken(content);
    return completed;
  }
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 1_600);
    throw new Error(provider.errorPrefix + ": " + response.status + " " + response.statusText + " – " + errorText);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json") || !response.body) {
    const completed = await response.json() as InvokeResult;
    const content = extractTextContent(completed.choices?.[0]?.message?.content ?? "");
    if (content) onToken(content);
    return completed;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let finishReason: string | null = null;
  let responseId = "";
  let responseCreated = Math.floor(Date.now() / 1_000);
  let responseModel = resolvedModel ?? "";

  const consumeEvent = (eventBlock: string) => {
    const data = eventBlock
      .split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") return;
    let event: Record<string, any>;
    try {
      event = JSON.parse(data) as Record<string, any>;
    } catch {
      // Some proxies emit non-JSON heartbeat lines. They are not model tokens.
      return;
    }
    if (typeof event.id === "string") responseId = event.id;
    if (typeof event.created === "number") responseCreated = event.created;
    if (typeof event.model === "string") responseModel = event.model;
    const choice = Array.isArray(event.choices) ? event.choices[0] : undefined;
    if (typeof choice?.finish_reason === "string") finishReason = choice.finish_reason;
    const token = extractStreamDelta(event);
    if (token) {
      fullText += token;
      onToken(token);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const eventBlock of events) consumeEvent(eventBlock);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) {
    throw new Error(provider.errorPrefix + ": streaming response completed without any text content");
  }
  return {
    id: responseId || "stream-" + responseCreated,
    created: responseCreated,
    model: responseModel,
    choices: [{
      index: 0,
      message: { role: "assistant", content: fullText },
      finish_reason: finishReason ?? "stop",
    }],
  };
}

const geminiProvider: ProviderRequestConfig = {
  apiBaseUrl: ENV.geminiApiBaseUrl,
  fallbackBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKey: ENV.geminiApiKey,
  apiKeyVariable: "GEMINI_API_KEY",
  defaultModel: ENV.geminiModel,
  errorPrefix: "Gemini invoke failed",
  // This endpoint's OpenAI compatibility layer does not implement every
  // structured response mode, so the application performs schema validation.
  omitResponseFormat: true,
};

const openRouterProvider: ProviderRequestConfig = {
  apiBaseUrl: ENV.openrouterApiBaseUrl,
  fallbackBaseUrl: "https://openrouter.ai/api/v1",
  apiKey: ENV.openrouterApiKey,
  apiKeyVariable: "OPENROUTER_API_KEY (or AI_API_KEY)",
  defaultModel: ENV.openrouterModel,
  errorPrefix: "OpenRouter invoke failed",
};

function hasUsableAssistantOutput(result: InvokeResult): boolean {
  const choice = result.choices?.[0];
  if (!choice) return false;
  if (choice.message.tool_calls?.length) return true;
  return extractTextContent(choice.message.content ?? "").trim().length > 0
    && choice.finish_reason !== "length";
}

function shouldFailOverFromGemini(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /GEMINI_API_KEY is not configured/i.test(message)
    || /Gemini invoke failed:\s*(?:400|401|402|403|404|408|409|425|429|5\d\d)\b/i.test(message)
    || /fetch failed|network error|timed out|socket|ECONNRESET|ENOTFOUND/i.test(message)
    || /unsupported|not supported|response_format|json_schema|invalid argument/i.test(message);
}

/** Explicit OpenRouter route for the free-model fallback and schema-validation retry. */
export async function invokeOpenRouterLLM(params: InvokeParams): Promise<InvokeResult> {
  return invokeWithProvider({ ...params, model: ENV.openrouterModel }, openRouterProvider);
}

/** Gemini is the primary assistant/planner provider; OpenRouter free router is the failover. */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    console.warn("[StudyFlow AI] GEMINI_API_KEY is unavailable; using OpenRouter free-model fallback.");
    return invokeOpenRouterLLM(params);
  }
  try {
    const result = await invokeWithProvider(
      { ...params, model: ENV.geminiModel },
      geminiProvider,
    );
    if (!hasUsableAssistantOutput(result)) throw new Error("Gemini invoke failed: empty or truncated assistant content");
    return result;
  } catch (error) {
    if (!shouldFailOverFromGemini(error)) throw error;
    console.warn("[StudyFlow AI] Gemini request was unavailable or unusable; switching to OpenRouter free-model router.", {
      reason: error instanceof Error ? error.message.slice(0, 180) : "provider_unavailable",
    });
    return invokeOpenRouterLLM(params);
  }
}

/** Stream Gemini first; switch before output only, never append two partial answers. */
export async function invokeLLMStream(
  params: InvokeParams,
  onToken: (token: string) => void,
): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    console.warn("[StudyFlow AI] GEMINI_API_KEY is unavailable for streaming; using OpenRouter.");
    return streamWithProvider({ ...params, model: ENV.openrouterModel }, openRouterProvider, onToken);
  }
  let emitted = false;
  const deliver = (token: string) => {
    if (token) emitted = true;
    onToken(token);
  };
  try {
    const result = await streamWithProvider({ ...params, model: ENV.geminiModel }, geminiProvider, deliver);
    if (!hasUsableAssistantOutput(result)) throw new Error("Gemini streaming response was empty or truncated");
    return result;
  } catch (error) {
    if (emitted || !shouldFailOverFromGemini(error)) throw error;
    console.warn("[StudyFlow AI] Gemini streaming was unavailable before output; switching to OpenRouter.");
    return streamWithProvider({ ...params, model: ENV.openrouterModel }, openRouterProvider, onToken);
  }
}

/** Legacy NVIDIA exports retained for compatibility; production routes below no longer use them. */
export async function invokeNvidiaLLM(params: InvokeParams): Promise<InvokeResult> {
  return invokeWithProvider(params, {
    apiBaseUrl: ENV.nvidiaApiBaseUrl,
    fallbackBaseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: ENV.nvidiaApiKey,
    apiKeyVariable: "NVIDIA_API_KEY",
    defaultModel: ENV.nvidiaModel,
    errorPrefix: "NVIDIA LLM invoke failed",
    pollPending: true,
    additionalBody: {
      reasoning_effort: "none",
      chat_template_kwargs: { force_nonempty_content: true },
      temperature: 0.2,
      stream: false,
    },
  });
}

export async function invokeNvidiaLLMStream(
  params: InvokeParams,
  onToken: (token: string) => void,
): Promise<InvokeResult> {
  return streamWithProvider(params, {
    apiBaseUrl: ENV.nvidiaApiBaseUrl,
    fallbackBaseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: ENV.nvidiaApiKey,
    apiKeyVariable: "NVIDIA_API_KEY",
    defaultModel: ENV.nvidiaModel,
    errorPrefix: "NVIDIA LLM streaming invoke failed",
    pollPending: true,
    additionalBody: {
      reasoning_effort: "none",
      chat_template_kwargs: { force_nonempty_content: true },
      temperature: 0.2,
    },
  }, onToken);
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey(ENV.openrouterApiKey, "OPENROUTER_API_KEY (or AI_API_KEY)");
  const modelsBase = (ENV.openrouterApiBaseUrl.trim() || "https://openrouter.ai/api/v1")
    .replace(/\\/+$/, "")
    .replace(/\\/chat\\/completions$/i, "")
    .replace(/\\/models$/i, "");
  const response = await fetchWithBackoff(`${modelsBase}/models`, {
    headers: { authorization: "Bearer " + ENV.openrouterApiKey },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("List OpenRouter models failed: " + response.status + " " + response.statusText + " – " + errorText);
  }
  return await response.json() as ModelsResponse;
}
