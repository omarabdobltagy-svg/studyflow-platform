import type { Tool } from "./_core/llm";

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3.1";
const SAFE_SEARCH_TOOLS = {
  COMPOSIO_SEARCH_WEB: {
    name: "composio_web_search",
    description: "Search the live web for current facts, documentation, research, and trustworthy sources. Use for questions that need fresh or niche information.",
  },
  COMPOSIO_SEARCH_DUCK_DUCK_GO: {
    name: "composio_duckduckgo_search",
    description: "Run a general web search and return relevant public web results.",
  },
  COMPOSIO_SEARCH_NEWS: {
    name: "composio_news_search",
    description: "Search recent news coverage. Use for recent events and updates; inspect the article date and event date.",
  },
  COMPOSIO_SEARCH_FETCH_URL_CONTENT: {
    name: "composio_fetch_url_content",
    description: "Fetch and extract readable text from a public HTTP or HTTPS page. Use after search when a source needs closer inspection.",
  },
  COMPOSIO_SEARCH_SCHOLAR: {
    name: "composio_scholar_search",
    description: "Search scholarly and academic publications for research evidence.",
  },
} as const;

type ComposioToolSlug = keyof typeof SAFE_SEARCH_TOOLS;

type ComposioToolRecord = {
  slug?: string;
  name?: string;
  description?: string;
  input_parameters?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
};

export type ComposioSearchSession = {
  sessionId: string;
  tools: Tool[];
  execute: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
};

function propertySchema(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: "string" };
  const item = value as Record<string, any>;
  const type = ["string", "number", "integer", "boolean", "array", "object"].includes(item.type)
    ? item.type
    : "string";
  const schema: Record<string, unknown> = { type };
  if (typeof item.description === "string") schema.description = item.description;
  if (Array.isArray(item.enum)) schema.enum = item.enum;
  if (item.default !== undefined) schema.default = item.default;
  if (item.minimum !== undefined) schema.minimum = item.minimum;
  if (item.maximum !== undefined) schema.maximum = item.maximum;
  if (type === "array") {
    schema.items = propertySchema(item.items ?? { type: "string" });
  }
  if (type === "object") {
    const nested = item.properties && typeof item.properties === "object"
      ? item.properties as Record<string, unknown>
      : {};
    schema.properties = Object.fromEntries(Object.entries(nested).map(([key, nestedValue]) => [key, propertySchema(nestedValue)]));
    schema.required = Array.isArray(item.required) ? item.required : [];
    schema.additionalProperties = false;
  }
  return schema;
}

function toFunctionParameters(tool: ComposioToolRecord): Record<string, unknown> {
  const source = tool.input_schema && typeof tool.input_schema === "object"
    ? tool.input_schema
    : tool.input_parameters && typeof tool.input_parameters === "object"
      ? tool.input_parameters
      : {};
  if ("properties" in source && source.type === "object") {
    const candidate = source as Record<string, any>;
    return {
      type: "object",
      properties: Object.fromEntries(Object.entries(candidate.properties ?? {}).map(([key, value]) => [key, propertySchema(value)])),
      required: Array.isArray(candidate.required) ? candidate.required : [],
      additionalProperties: false,
    };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const schema = propertySchema(value);
    properties[key] = schema;
    if (Boolean((value as Record<string, unknown> | null)?.required)) required.push(key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

async function composioRequest(path: string, apiKey: string, init?: RequestInit): Promise<any> {
  const response = await fetch(COMPOSIO_API_BASE + path, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw: raw.slice(0, 1_500) }; }
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : raw.slice(0, 500);
    throw new Error("Composio API " + response.status + ": " + message);
  }
  return payload;
}

export function isComposioSearchConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

/**
 * Create an isolated Composio session for this StudyFlow account. Only the
 * read-oriented Composio Search toolkit is discoverable in this session;
 * execution is additionally restricted to the explicit slug allowlist below.
 */
export async function createComposioSearchSession(userId: number): Promise<ComposioSearchSession | null> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const sessionPayload = await composioRequest("/tool_router/session", apiKey, {
      method: "POST",
      body: JSON.stringify({
        user_id: "studyflow:" + String(userId),
        toolkits: { enable: ["composio_search"] },
      }),
    });
    const sessionId = [
      sessionPayload?.session_id,
      sessionPayload?.sessionId,
      sessionPayload?.id,
      sessionPayload?.data?.session_id,
      sessionPayload?.data?.id,
    ].find(value => typeof value === "string" && value.length > 0) as string | undefined;
    if (!sessionId) throw new Error("Composio did not return a session ID.");

    const toolsPayload = await composioRequest(
      "/tool_router/session/" + encodeURIComponent(sessionId) + "/tools?limit=100",
      apiKey,
    );
    const available = Array.isArray(toolsPayload?.items) ? toolsPayload.items as ComposioToolRecord[] : [];
    const bySlug = new Map(available.map(tool => [String(tool.slug ?? ""), tool]));
    const exposed = (Object.entries(SAFE_SEARCH_TOOLS) as Array<[ComposioToolSlug, typeof SAFE_SEARCH_TOOLS[ComposioToolSlug]]>)
      .filter(([slug]) => bySlug.has(slug))
      .map(([slug, definition]) => ({
        type: "function" as const,
        function: {
          name: definition.name,
          description: definition.description,
          parameters: toFunctionParameters(bySlug.get(slug)!),
        },
      }));

    const slugByName = new Map(
      (Object.entries(SAFE_SEARCH_TOOLS) as Array<[ComposioToolSlug, typeof SAFE_SEARCH_TOOLS[ComposioToolSlug]]>)
        .map(([slug, definition]) => [definition.name, slug]),
    );

    return {
      sessionId,
      tools: exposed,
      execute: async (toolName, args) => {
        const slug = slugByName.get(toolName);
        if (!slug || !bySlug.has(slug)) throw new Error("This Composio action is not allowed in StudyFlow.");
        const result = await composioRequest(
          "/tool_router/session/" + encodeURIComponent(sessionId) + "/execute",
          apiKey,
          {
            method: "POST",
            body: JSON.stringify({ tool_slug: slug, arguments: args }),
          },
        );
        return result;
      },
    };
  } catch (error) {
    console.warn("[StudyFlow Composio] Web search initialization failed:", error instanceof Error ? error.message.slice(0, 500) : "unknown error");
    return null;
  }
}

export function serializeComposioToolResult(value: unknown, maxLength = 14_000): string {
  let serialized = "";
  try { serialized = JSON.stringify(value); } catch { serialized = String(value); }
  return serialized.length > maxLength ? serialized.slice(0, maxLength) + "\n[تم اختصار النتيجة]" : serialized;
}
