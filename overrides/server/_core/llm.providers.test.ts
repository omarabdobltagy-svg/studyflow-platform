import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: {
    geminiApiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    geminiApiKey: "gemini-test-key",
    geminiModel: "gemini-3.8-flash",
    openrouterApiBaseUrl: "https://openrouter.ai/api/v1",
    openrouterApiKey: "openrouter-test-key",
    openrouterModel: "openrouter/free",
    aiApiBaseUrl: "https://openrouter.ai/api/v1",
    aiApiKey: "openrouter-test-key",
    aiModel: "openrouter/free",
    nvidiaApiBaseUrl: "https://integrate.api.nvidia.com/v1",
    nvidiaApiKey: "",
    nvidiaModel: "nvidia/test",
  },
}));

import { invokeLLM, invokeOpenRouterLLM } from "./llm";

const response = (content: string, finishReason = "stop") => new Response(JSON.stringify({
  id: "test", created: 1, model: "test-model",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
}), { status: 200, headers: { "content-type": "application/json" } });

const requestDetails = (call: unknown[]) => {
  const [url, init] = call as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown> };
};

beforeEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Gemini-first provider routing", () => {
  it("uses Gemini Flash first and keeps a valid response without calling OpenRouter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response("Gemini primary response"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    const first = requestDetails(fetchMock.mock.calls[0]);
    expect(first.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(new Headers(first.init.headers).get("authorization")).toBe("Bearer gemini-test-key");
    expect(first.body.model).toBe("gemini-3.8-flash");
    expect(first.body.response_format).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.choices[0].message.content).toBe("Gemini primary response");
  });

  it("fails over to the OpenRouter free-model router when Gemini credentials are rejected", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(response("OpenRouter fallback response"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    const primary = requestDetails(fetchMock.mock.calls[0]);
    const fallback = requestDetails(fetchMock.mock.calls[1]);
    expect(primary.url).toContain("generativelanguage.googleapis.com");
    expect(fallback.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(fallback.init.headers).get("authorization")).toBe("Bearer openrouter-test-key");
    expect(fallback.body.model).toBe("openrouter/free");
    expect(result.choices[0].message.content).toBe("OpenRouter fallback response");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails over when Gemini returns an empty or truncated response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response("", "length")).mockResolvedValueOnce(response("Recovered response"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    expect(requestDetails(fetchMock.mock.calls[0]).body.model).toBe("gemini-3.8-flash");
    expect(requestDetails(fetchMock.mock.calls[1]).body.model).toBe("openrouter/free");
    expect(result.choices[0].message.content).toBe("Recovered response");
  });

  it("allows explicit OpenRouter calls for a structured-output validation retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response("{\"valid\":true}"));
    vi.stubGlobal("fetch", fetchMock);
    await invokeOpenRouterLLM({ model: "ignored-caller-model", response_format: { type: "json_object" }, messages: [{ role: "user", content: "Return JSON" }] });
    const request = requestDetails(fetchMock.mock.calls[0]);
    expect(request.body.model).toBe("openrouter/free");
    expect(request.body.response_format).toEqual({ type: "json_object" });
  });
});
