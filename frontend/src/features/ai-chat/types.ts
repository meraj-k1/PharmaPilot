
export type ChatRole = "user" | "assistant";

export type ChatSource = {
  id: string;
  title: string;
  excerpt: string;
  similarity: number | null;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  sources?: ChatSource[];
};

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type ChatReply = {
  answer: string;
  sources: ChatSource[];
};

export function createMessage(
  role: ChatRole,
  content: string,
  sources: ChatSource[] = []
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    sources,
  };
}
