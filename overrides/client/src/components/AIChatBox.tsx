import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Mic, Send, User, Sparkles, Square } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
  /** Optional content displayed above the composer input (for pending attachments). */
  inputAccessory?: ReactNode;
  /** Optional controls rendered beside the voice and send buttons. */
  inputActions?: ReactNode;
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  inputAccessory,
  inputActions,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldFollowScrollRef = useRef(true);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  const getScrollViewport = () => scrollAreaRef.current?.querySelector(
    '[data-radix-scroll-area-viewport]'
  ) as HTMLDivElement | null;

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
  };

  // Track whether the student is following the newest answer. Token updates
  // never pull the viewport down after the student has intentionally scrolled up.
  useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    const updateFollowState = () => {
      const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldFollowScrollRef.current = remaining < 120;
    };
    viewport.addEventListener("scroll", updateFollowState, { passive: true });
    updateFollowState();
    return () => viewport.removeEventListener("scroll", updateFollowState);
  }, [displayMessages.length]);

  useEffect(() => {
    if (shouldFollowScrollRef.current) scrollToBottom("auto");
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    shouldFollowScrollRef.current = true;
    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("التعرّف الصوتي غير متاح في هذا المتصفح. جرّب Chrome أو اكتب رسالتك يدويًا.");
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    setVoiceError(null);
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "ar-EG";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>).map(result => result[0]?.transcript || "").join(" ");
      setInput(transcript);
    };
    recognition.onerror = () => {
      setVoiceError("تعذّر التقاط الصوت. تأكد من إذن الميكروفون ثم حاول مرة أخرى.");
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  return (
    <div
      className={cn(
        "ai-chat-shell flex flex-col overflow-hidden rounded-[1.35rem] border border-primary/10 bg-card text-card-foreground shadow-[0_24px_70px_-35px_rgba(45,37,92,.6)]",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        shouldFollowScrollRef.current = true;
                        onSendMessage(prompt);
                      }}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                const isLastMessage = index === displayMessages.length - 1;
                const isStreamingAssistant = isLoading && isLastMessage && message.role === "assistant";

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="sf-ai-stream-message">
                          {message.content ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : isStreamingAssistant ? (
                            <span className="sf-ai-stream-empty" role="status">المساعد بيكتب الرد الآن<span className="sf-ai-stream-dots" aria-hidden="true"><i /><i /><i /></span></span>
                          ) : null}
                          {isStreamingAssistant && Boolean(message.content) && <span className="sf-ai-stream-cursor" aria-hidden="true" />}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 border-t bg-background/50 p-3 sm:p-4"
      >
        {inputAccessory ? (
          <div className="flex w-full flex-wrap items-center gap-2">{inputAccessory}</div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-9 max-h-32 min-w-0 flex-1 resize-none"
            rows={1}
          />
          {inputActions}
          <Button type="button" size="icon" variant="outline" onClick={toggleVoice} disabled={isLoading} aria-label={isRecording ? "جاري التسجيل" : "تحويل الصوت إلى نص"} className={cn("h-[38px] w-[38px] shrink-0 rounded-xl", isRecording && "border-rose-400 bg-rose-50 text-rose-600")}>{isRecording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}</Button>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            aria-label="إرسال الرسالة"
            className="h-[38px] w-[38px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </form>
      {voiceError && <p role="status" className="border-t border-border/70 px-4 py-2 text-xs text-rose-600">{voiceError}</p>}
    </div>
  );
}
