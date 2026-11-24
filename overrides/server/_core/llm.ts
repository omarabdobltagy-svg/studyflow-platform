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
  const { role, name, tool_call_id } = message;

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

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
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

  // NVIDIA's hosted Nemotron endpoint does not advertise structured output.
  // Planner responses are validated by its Zod schema before anything is saved.
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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  return invokeWithProvider(params, {
    apiBaseUrl: ENV.aiApiBaseUrl,
    fallbackBaseUrl: "https://openrouter.ai/api/v1",
    apiKey: ENV.aiApiKey,
    apiKeyVariable: "AI_API_KEY",
    defaultModel: ENV.aiModel,
    errorPrefix: "LLM invoke failed",
  });
}

/** Dedicated NVIDIA NIM client with credentials isolated from the primary provider. */
export async function invokeNvidiaLLM(params: InvokeParams): Promise<InvokeResult> {
  return invokeWithProvider(params, {
    apiBaseUrl: ENV.nvidiaApiBaseUrl,
    fallbackBaseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: ENV.nvidiaApiKey,
    apiKeyVariable: "NVIDIA_API_KEY",
    defaultModel: ENV.nvidiaModel,
    errorPrefix: "NVIDIA LLM invoke failed",
    pollPending: true,
    // Keep reasoning bounded so the completion has enough tokens for its JSON plan.
    additionalBody: { reasoning_effort: "medium", reasoning_budget: 1_024, stream: false },
  });
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
  assertApiKey(ENV.aiApiKey, "AI_API_KEY");

  // Model discovery must use the same OpenAI-compatible provider and API key
  // as chat completions; the old Forge endpoint belongs to the retired auth stack.
  const configuredBase = ENV.aiApiBaseUrl.trim() || "https://openrouter.ai/api/v1";
  const modelsBase = configuredBase
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/models$/i, "");
  const url = `${modelsBase}/models`;

  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${ENV.aiApiKey}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}
