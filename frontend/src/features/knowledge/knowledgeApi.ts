
import { api } from "../../lib/api";

import type {
  KnowledgeDocument,
  KnowledgeResult,
  KnowledgeSearchResponse,
} from "./types";

export const KNOWLEDGE_ENDPOINTS = {
  documents: "/knowledge/documents",
  upload: "/knowledge/documents",
  search: "/knowledge/search",
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : String(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractArray(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) {
    if (!payload.every(isObject)) {
      throw new Error("Invalid API list response.");
    }
    return payload;
  }

  if (isObject(payload)) {
    const nestedData = isObject(payload.data)
      ? payload.data
      : null;

    const candidates = [
      payload.items,
      payload.results,
      payload.documents,
      payload.data,
      nestedData?.items,
      nestedData?.results,
      nestedData?.documents,
    ];

    for (const candidate of candidates) {
      if (
        Array.isArray(candidate) &&
        candidate.every(isObject)
      ) {
        return candidate;
      }
    }
  }

  throw new Error(
    "Unexpected knowledge API response. " +
    "Verify the response format in Swagger."
  );
}

function normalizeDocument(
  raw: JsonObject
): KnowledgeDocument {
  const id = stringValue(
    raw.id ?? raw.document_id
  );

  if (!id) {
    throw new Error(
      "Knowledge document response has no ID."
    );
  }

  return {
    id,
    filename: stringValue(
      raw.filename ??
      raw.file_name ??
      raw.title ??
      raw.source_name
    ) || "Untitled document",
    status: stringValue(
      raw.status ?? raw.processing_status
    ) || "Unknown",
    chunk_count: numberValue(
      raw.chunk_count ?? raw.total_chunks
    ),
    created_at:
      typeof raw.created_at === "string"
        ? raw.created_at
        : null,
  };
}

function normalizeResult(
  raw: JsonObject
): KnowledgeResult {
  const source = isObject(raw.source)
    ? raw.source
    : null;

  return {
    id: stringValue(
      raw.id ?? raw.chunk_id
    ),
    content: stringValue(
      raw.content ??
      raw.text ??
      raw.chunk_text
    ),
    source_name: stringValue(
      raw.source_name ??
      raw.filename ??
      raw.document_title ??
      source?.filename ??
      source?.title
    ) || "Source not provided",
    similarity: numberValue(
      raw.similarity ??
      raw.similarity_score ??
      raw.score
    ),
  };
}

export async function getKnowledgeDocuments():
  Promise<KnowledgeDocument[]> {
  const response = await api.get<unknown>(
    KNOWLEDGE_ENDPOINTS.documents,
    {
      params: { limit: 100, offset: 0 },
    }
  );

  return extractArray(response.data)
    .map(normalizeDocument);
}

export async function searchKnowledge(
  query: string,
  topK = 5
): Promise<KnowledgeSearchResponse> {
  /*
   * Assumed request:
   * POST /api/v1/knowledge/search
   * { query: string, top_k: number }
   *
   * Change this mapping if your Swagger
   * defines a GET endpoint or other body.
   */
  const response = await api.post<unknown>(
    KNOWLEDGE_ENDPOINTS.search,
    {
      query,
      top_k: topK,
    }
  );

  const payload = response.data;
  const root = isObject(payload) ? payload : null;

  const nested = root && isObject(root.data)
    ? root.data
    : null;

  const resultContainer = nested ?? root ?? payload;

  return {
    query:
      stringValue(
        nested?.query ?? root?.query
      ) || query,
    results: extractArray(resultContainer)
      .map(normalizeResult),
  };
}

export async function uploadKnowledgeDocument(
  file: File
): Promise<unknown> {
  /*
   * Assumes multipart upload with field "file".
   * Verify accepted extensions and form field
   * in your FastAPI Swagger documentation.
   */
  const form = new FormData();
  form.append("file", file);

  const response = await api.post(
    KNOWLEDGE_ENDPOINTS.upload,
    form,
    {
      headers: {
        "Content-Type": undefined,
      },
      timeout: 120000,
    }
  );

  return response.data;
}
