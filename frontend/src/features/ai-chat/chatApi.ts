
import { api } from "../../lib/api";

import type {
  ChatReply,
  ChatSource,
} from "./types";

export const CHAT_ENDPOINT = "/conversations/chat";

type JsonRecord = Record<string, unknown>;

export type ChatResponse = {
  conversation_id: string;
  message: string;
  model: string;
  tools_used: {
    name: string;
    arguments: Record<string, unknown>;
    result_count: number | null;
  }[];
};

let activeConversationId: string | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : null;
}

function normalizeSource(
  value: unknown,
  index: number
): ChatSource | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = isRecord(value.source)
    ? value.source
    : null;

  return {
    id:
      asString(value.id ?? value.chunk_id) ||
      `source-${index + 1}`,

    title:
      asString(
        value.title ??
        value.filename ??
        value.source_name ??
        value.document_title ??
        source?.title ??
        source?.filename
      ) || `Source ${index + 1}`,

    excerpt: asString(
      value.excerpt ??
      value.content ??
      value.text ??
      value.chunk_text
    ),

    similarity: asNumber(
      value.similarity ??
      value.similarity_score ??
      value.score
    ),
  };
}

function normalizeReply(payload: unknown): ChatReply {
  if (!isRecord(payload)) {
    throw new Error("Unexpected chat response format.");
  }

  const data = isRecord(payload.data)
    ? payload.data
    : payload;

  const answer =
    asString(data.message) ||
    asString(data.answer) ||
    asString(data.response) ||
    asString(data.reply);

  if (!answer) {
    throw new Error(
      "Chat response does not contain a message."
    );
  }

  const rawSources =
    data.sources ??
    data.citations ??
    data.retrieved_chunks;

  const sources = Array.isArray(rawSources)
    ? rawSources
        .map(normalizeSource)
        .filter(
          (item): item is ChatSource => item !== null
        )
    : [];

  return {
    answer,
    sources,
  };
}

export function getActiveConversationId(): string | null {
  return activeConversationId;
}

export function resetChatConversation(): void {
  activeConversationId = null;
}

export async function sendChatMessage(
  message: string
): Promise<ChatReply> {
  const cleanedMessage = message.trim();

  if (!cleanedMessage) {
    throw new Error("Message cannot be empty.");
  }

  if (cleanedMessage.length > 4000) {
    throw new Error(
      "Message cannot exceed 4000 characters."
    );
  }

  const response = await api.post<ChatResponse>(
    CHAT_ENDPOINT,
    {
      message: cleanedMessage,
      conversation_id: activeConversationId,
    },
    {
      timeout: 120000,
    }
  );

  const data = response.data;

  if (typeof data.conversation_id === "string") {
    activeConversationId = data.conversation_id;
  }

  return normalizeReply(data);
}
