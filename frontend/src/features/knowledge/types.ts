
export type KnowledgeDocument = {
  id: string;
  filename: string;
  status: string;
  chunk_count: number | null;
  created_at: string | null;
};

export type KnowledgeResult = {
  id: string;
  content: string;
  source_name: string;
  similarity: number | null;
};

export type KnowledgeSearchResponse = {
  query: string;
  results: KnowledgeResult[];
};

export type KnowledgeTab = "documents" | "search";
