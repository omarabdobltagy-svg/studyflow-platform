import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn(), invokeLLMStream: vi.fn() }));
vi.mock("./llm", () => ({ invokeLLM: mocks.invokeLLM, invokeLLMStream: mocks.invokeLLMStream }));

import { invokeLLMWithNvidiaFallback, invokeLLMWithNvidiaFallbackStream, isPrimaryProviderFallbackEligible } from "./llmFallback";

beforeEach(() => vi.clearAllMocks());

describe("Gemini / OpenRouter compatibility wrapper", () => {
  it("delegates to the Gemini-first client, which owns OpenRouter failover", async () => {
    const result = { id: "gemini", choices: [{ message: { content: "ok" } }] };
    mocks.invokeLLM.mockResolvedValue(result);
    await expect(invokeLLMWithNvidiaFallback({ messages: [{ role: "user", content: "test" }] })).resolves.toBe(result);
    expect(mocks.invokeLLM).toHaveBeenCalledOnce();
  });

  it("delegates streaming without appending a second provider response", async () => {
    const result = { id: "openrouter", choices: [{ message: { content: "ok" } }] };
    mocks.invokeLLMStream.mockResolvedValue(result);
    const onToken = vi.fn();
    await expect(invokeLLMWithNvidiaFallbackStream({ messages: [{ role: "user", content: "test" }] }, onToken)).resolves.toBe(result);
    expect(mocks.invokeLLMStream).toHaveBeenCalledOnce();
  });

  it("recognizes common Gemini availability errors for compatibility callers", () => {
    expect(isPrimaryProviderFallbackEligible(new Error("Gemini invoke failed: 429 quota exhausted"))).toBe(true);
    expect(isPrimaryProviderFallbackEligible(new Error("Gemini invoke failed: 401 Unauthorized"))).toBe(true);
    expect(isPrimaryProviderFallbackEligible(new Error("unrelated application invariant"))).toBe(false);
  });
});
