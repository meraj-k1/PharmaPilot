
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { AxiosError } from "axios";

import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import {
  resetChatConversation,
  sendChatMessage,
} from "./chatApi";

import type { ChatSource } from "./types";

import "./chat.css";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  sources: ChatSource[];
};

type Notice = {
  type: "success" | "error";
  message: string;
};

const SUGGESTED_PROMPTS = [
  "Search for Napa medicine",
  "Which medicines are low in stock?",
  "Show medicines expiring soon",
  "Explain the use of Paracetamol",
];

function createMessage(
  role: MessageRole,
  content: string,
  sources: ChatSource[] = []
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date(),
    sources,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      return "Your session has expired. Please log in again.";
    }

    if (status === 403) {
      return "You do not have permission to access this pharmacy.";
    }

    if (status === 422) {
      return "The chat request is invalid. Please check your message.";
    }

    if (status === 429) {
      return "The AI service is receiving too many requests. Please try again later.";
    }

    if (status === 502 || status === 503 || status === 504) {
      return "The AI service is temporarily unavailable. Please try again later.";
    }

    if (
      typeof data?.error?.message === "string"
    ) {
      return data.error.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    return error.message || "Unable to send message.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceList({
  sources,
}: {
  sources: ChatSource[];
}) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="chat-sources">
      <div className="chat-sources-title">
        Sources
      </div>

      {sources.map((source) => (
        <div
          key={source.id}
          className="chat-source"
        >
          <strong>{source.title}</strong>

          {source.excerpt && (
            <p>{source.excerpt}</p>
          )}

          {source.similarity !== null && (
            <small>
              Similarity:{" "}
              {(source.similarity * 100).toFixed(1)}%
            </small>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [input, setInput] = useState("");

  const [sending, setSending] = useState(false);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const sendingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  async function submitMessage(
    text: string
  ): Promise<void> {
    const cleanedMessage = text.trim();

    if (!cleanedMessage || sendingRef.current) {
      return;
    }

    if (cleanedMessage.length > 4000) {
      setNotice({
        type: "error",
        message: "Message cannot exceed 4000 characters.",
      });
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setNotice(null);
    setInput("");

    const userMessage = createMessage(
      "user",
      cleanedMessage
    );

    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    try {
      const reply = await sendChatMessage(
        cleanedMessage
      );

      const assistantMessage = createMessage(
        "assistant",
        reply.answer,
        reply.sources
      );

      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    void submitMessage(input);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  function handleNewChat() {
    if (sendingRef.current) {
      return;
    }

    resetChatConversation();
    setMessages([]);
    setInput("");
    setNotice(null);

    textareaRef.current?.focus();
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <div>
          <span className="eyebrow">
            PHARMAPILOT AI
          </span>

          <h1>AI Assistant</h1>

          <p>
            Ask questions about medicines,
            inventory, pharmacy knowledge
            and daily operations.
          </p>
        </div>

        <button
          type="button"
          className="chat-new-button"
          onClick={handleNewChat}
          disabled={sending}
        >
          <MessageSquarePlus size={18} />
          New Chat
        </button>
      </div>

      {notice && (
        <div
          className={`chat-notice ${notice.type}`}
          role="alert"
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span>{notice.message}</span>

          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="chat-panel">
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <div className="chat-panel-icon">
              <Bot size={21} />
            </div>

            <div>
              <strong>
                PharmaPilot Assistant
              </strong>

              <span>
                Pharmacy AI workspace
              </span>
            </div>
          </div>

          <div className="chat-status">
            <span className="chat-status-dot" />
            Ready
          </div>
        </div>

        <div className="chat-messages">
          {!hasMessages && (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">
                <Sparkles size={34} />
              </div>

              <h2>
                How can I help your pharmacy?
              </h2>

              <p>
                Search medicines, explore inventory,
                ask questions and use your uploaded
                pharmacy knowledge.
              </p>

              <div className="chat-suggestions">
                {SUGGESTED_PROMPTS.map(
                  (prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() =>
                        void submitMessage(prompt)
                      }
                      disabled={sending}
                    >
                      <Sparkles size={15} />
                      {prompt}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${
                message.role === "user"
                  ? "user"
                  : "assistant"
              }`}
            >
              <div className="chat-message-avatar">
                {message.role === "user" ? (
                  <UserRound size={18} />
                ) : (
                  <Bot size={18} />
                )}
              </div>

              <div className="chat-message-body">
                <div className="chat-message-meta">
                  <strong>
                    {message.role === "user"
                      ? "You"
                      : "PharmaPilot AI"}
                  </strong>

                  <span>
                    {formatTime(
                      message.createdAt
                    )}
                  </span>
                </div>

                <div className="chat-message-content">
                  {message.content}
                </div>

                <SourceList
                  sources={message.sources}
                />
              </div>
            </div>
          ))}

          {sending && (
            <div className="chat-message assistant">
              <div className="chat-message-avatar">
                <Bot size={18} />
              </div>

              <div className="chat-message-body">
                <div className="chat-message-meta">
                  <strong>
                    PharmaPilot AI
                  </strong>
                </div>

                <div className="chat-message-content">
                  <Loader2
                    size={18}
                    className="chat-spin"
                  />

                  <span>
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-composer">
          <form onSubmit={handleSubmit}>
            <div className="chat-composer-input">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={handleKeyDown}
                placeholder="Ask PharmaPilot anything..."
                rows={2}
                maxLength={4000}
                disabled={sending}
                aria-label="Chat message"
              />

              <button
                type="submit"
                className="chat-send-button"
                disabled={
                  sending ||
                  !input.trim()
                }
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2
                    size={19}
                    className="chat-spin"
                  />
                ) : (
                  <Send size={19} />
                )}
              </button>
            </div>
          </form>

          <div className="chat-composer-footer">
            <span>
              Press Enter to send · Shift + Enter
              for a new line
            </span>

            <span>
              {input.length}/4000
            </span>
          </div>

          <p className="chat-disclaimer">
            AI-generated information may be
            inaccurate. Verify important
            medication and clinical decisions
            with qualified professionals.
          </p>
        </div>
      </section>
    </div>
  );
}
