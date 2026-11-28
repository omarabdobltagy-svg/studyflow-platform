export type AssistantConversationRole = "user" | "assistant";

export type AssistantConversationDraft = {
  clientId: string;
  title: string;
  messages: Array<{ role: AssistantConversationRole; content: string }>;
};

const MAX_MESSAGES_PER_CONVERSATION = 40;
const MAX_MESSAGE_LENGTH = 12_000;
const MAX_TITLE_LENGTH = 80;
const MAX_CLIENT_ID_LENGTH = 80;

export function normalizeAssistantConversationDraft(input: unknown): AssistantConversationDraft | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (typeof record.clientId !== "string" || typeof record.title !== "string" || !Array.isArray(record.messages)) {
    return null;
  }

  const clientId = record.clientId.trim();
  const title = record.title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!clientId || clientId.length > MAX_CLIENT_ID_LENGTH || !title) return null;

  const messages = record.messages.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const message = value as Record<string, unknown>;
    if (message.role !== "user" && message.role !== "assistant") return [];
    if (typeof message.content !== "string") return [];
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return [];
    return [{ role: message.role as AssistantConversationRole, content }];
  }).slice(-MAX_MESSAGES_PER_CONVERSATION);

  return { clientId, title, messages };
}

