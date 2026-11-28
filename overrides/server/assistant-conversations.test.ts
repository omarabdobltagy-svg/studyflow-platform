import { describe, expect, it } from "vitest";
import { normalizeAssistantConversationDraft } from "./assistant-conversations";

describe("assistant conversation persistence boundaries", () => {
  it("accepts only a valid client identity and bounded conversation content", () => {
    expect(normalizeAssistantConversationDraft({
      clientId: "thread-1",
      title: "محادثة المنهج",
      messages: [
        { role: "user", content: "اشرح الدرس" },
        { role: "assistant", content: "هذا شرح مختصر." },
      ],
    })).toEqual({
      clientId: "thread-1",
      title: "محادثة المنهج",
      messages: [
        { role: "user", content: "اشرح الدرس" },
        { role: "assistant", content: "هذا شرح مختصر." },
      ],
    });
  });

  it("rejects invalid thread identities and empty titles", () => {
    expect(normalizeAssistantConversationDraft({ clientId: " ", title: "عنوان", messages: [] })).toBeNull();
    expect(normalizeAssistantConversationDraft({ clientId: "thread-1", title: " ", messages: [] })).toBeNull();
    expect(normalizeAssistantConversationDraft({ clientId: "x".repeat(81), title: "عنوان", messages: [] })).toBeNull();
    expect(normalizeAssistantConversationDraft(null)).toBeNull();
  });

  it("filters malformed messages and keeps only the latest forty", () => {
    const messages = Array.from({ length: 45 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: "رسالة " + index,
    }));
    messages.push({ role: "system", content: "hidden control text" } as any);
    messages.push({ role: "user", content: "x".repeat(12_001) });

    const result = normalizeAssistantConversationDraft({
      clientId: "thread-1",
      title: "  عنوان طويل  ",
      messages,
    });

    expect(result?.messages).toHaveLength(40);
    expect(result?.messages[0].content).toBe("رسالة 5");
    expect(result?.messages.at(-1)?.content).toBe("رسالة 44");
    expect(result?.title).toBe("عنوان طويل");
  });

  it("does not persist empty assistant placeholders", () => {
    const result = normalizeAssistantConversationDraft({
      clientId: "thread-1",
      title: "عنوان",
      messages: [
        { role: "user", content: "سؤال صحيح" },
        { role: "assistant", content: " " },
      ],
    });
    expect(result?.messages).toEqual([{ role: "user", content: "سؤال صحيح" }]);
  });
});
