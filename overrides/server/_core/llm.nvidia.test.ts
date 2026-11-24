import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("NVIDIA Nemotron provider", () => {
  it("uses its dedicated key and the documented non-streaming chat endpoint", async () => {
    vi.resetModules();
    vi.stubEnv("NVIDIA_API_KEY", "unit-test-nvidia-key");
    vi.stubEnv("NVIDIA_API_BASE_URL", "https://integrate.api.nvidia.com/v1");
    vi.stubEnv("NVIDIA_MODEL", "nvidia/nemotron-3-ultra-550b-a55b");

    const expectedContent = JSON.stringify({ ok: true });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "test-response",
      created: 1,
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      choices: [{
        index: 0,
        message: { role: "assistant", content: expectedContent },
        finish_reason: "stop",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeNvidiaLLM } = await import("./llm");
    const result = await invokeNvidiaLLM({
      messages: [{ role: "user", content: "Return JSON." }],
      maxTokens: 200,
      response_format: { type: "json_object" },
    });

    expect(result.choices[0].message.content).toBe(expectedContent);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer unit-test-nvidia-key");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    expect(body.max_tokens).toBe(200);
    expect(body.reasoning_effort).toBe("medium");
    expect(body.stream).toBe(false);
    expect(body.response_format).toBeUndefined();
  });

  it("does not send a request when NVIDIA_API_KEY is absent", async () => {
    vi.resetModules();
    vi.stubEnv("NVIDIA_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { invokeNvidiaLLM } = await import("./llm");
    await expect(invokeNvidiaLLM({
      messages: [{ role: "user", content: "Return JSON." }],
    })).rejects.toThrow("NVIDIA_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
