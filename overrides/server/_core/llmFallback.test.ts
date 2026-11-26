import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  invokeNvidiaLLM: vi.fn(),
}));

vi.mock("./llm", () => ({
  invokeLLM: mocks.invokeLLM,
  invokeNvidiaLLM: mocks.invokeNvidiaLLM,
}));

import { invokeLLMWithNvidiaFallback, isPrimaryProviderFallbackEligible } from "./llmFallback";

const primaryResponse = (content = "إجابة مكتملة", finish_reason: string | null = "stop") => ({
  id: "primary", created: 1, model: "primary-model",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason }],
});

const nvidiaResponse = {
  id: "nvidia", created: 1, model: "nvidia/nemotron-3-ultra-550b-a55b",
  choices: [{ index: 0, message: { role: "assistant", content: "إجابة احتياطية مكتملة" }, finish_reason: "stop" }],
};

beforeEach(() => vi.clearAllMocks());

describe("primary provider fallback eligibility", () => {
  it("recognizes missing keys, billing failures and explicit quota exhaustion", () => {
    expect(isPrimaryProviderFallbackEligible(new Error("AI_API_KEY is not configured"))).toBe(true);
    expect(isPrimaryProviderFallbackEligible(new Error("LLM invoke failed: 402 Payment Required"))).toBe(true);
    expect(isPrimaryProviderFallbackEligible(new Error("429 insufficient_quota"))).toBe(true);
  });

  it("does not switch for unrelated server, authentication or validation errors", () => {
    expect(isPrimaryProviderFallbackEligible(new Error("LLM invoke failed: 500 Internal Server Error"))).toBe(false);
    expect(isPrimaryProviderFallbackEligible(new Error("LLM invoke failed: 401 Unauthorized"))).toBe(false);
    expect(isPrimaryProviderFallbackEligible(new Error("Unsupported response_format"))).toBe(false);
  });
});

describe("assistant NVIDIA fallback", () => {
  it("keeps a complete primary response", async () => {
    mocks.invokeLLM.mockResolvedValue(primaryResponse());
    const result = await invokeLLMWithNvidiaFallback({ messages: [{ role: "user", content: "سؤال" }] });
    expect(result.model).toBe("primary-model");
    expect(mocks.invokeNvidiaLLM).not.toHaveBeenCalled();
  });

  it("switches when the primary provider has exhausted credits", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 402 Payment Required – Insufficient credits"));
    mocks.invokeNvidiaLLM.mockResolvedValue(nvidiaResponse);
    const result = await invokeLLMWithNvidiaFallback({ messages: [{ role: "user", content: "سؤال" }] });
    expect(result.model).toBe(nvidiaResponse.model);
    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
  });

  it("uses NVIDIA's configured model instead of the primary provider model", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 402 Payment Required"));
    mocks.invokeNvidiaLLM.mockResolvedValue(nvidiaResponse);
    const params = {
      model: "deepseek/deepseek-v4.1-flash-1017",
      messages: [{ role: "user" as const, content: "سؤال" }],
    };

    await invokeLLMWithNvidiaFallback(params);

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledWith({ ...params, model: undefined });
  });

  it("switches when primary HTTP 200 has empty or truncated content", async () => {
    mocks.invokeLLM.mockResolvedValue(primaryResponse("", "length"));
    mocks.invokeNvidiaLLM.mockResolvedValue(nvidiaResponse);
    const result = await invokeLLMWithNvidiaFallback({ messages: [{ role: "user", content: "سؤال" }] });
    expect(result.model).toBe(nvidiaResponse.model);
    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
  });

  it("does not switch on an unrelated primary 500", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 500 Internal Server Error"));
    await expect(invokeLLMWithNvidiaFallback({ messages: [{ role: "user", content: "سؤال" }] })).rejects.toThrow("500 Internal Server Error");
    expect(mocks.invokeNvidiaLLM).not.toHaveBeenCalled();
  });

  it("propagates NVIDIA failure instead of returning an empty result", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("AI_API_KEY is not configured"));
    mocks.invokeNvidiaLLM.mockRejectedValue(new Error("NVIDIA_API_KEY is not configured"));
    await expect(invokeLLMWithNvidiaFallback({ messages: [{ role: "user", content: "سؤال" }] })).rejects.toThrow("NVIDIA_API_KEY is not configured");
  });
});
