
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { AxiosError } from "axios";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  UploadCloud,
  X,
} from "lucide-react";

import {
  getKnowledgeDocuments,
  searchKnowledge,
  uploadKnowledgeDocument,
} from "./knowledgeApi";

import type {
  KnowledgeDocument,
  KnowledgeResult,
  KnowledgeTab,
} from "./types";

import "./knowledge.css";


function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const payload = error.response?.data;

    if (typeof payload?.error?.message === "string") {
      return payload.error.message;
    }

    if (typeof payload?.detail === "string") {
      return payload.detail;
    }

    if (Array.isArray(payload?.detail)) {
      return payload.detail
        .map((entry: { msg?: string }) => entry.msg)
        .filter(Boolean)
        .join("; ");
    }

    return (
      `Request failed (${error.response?.status ?? "network"}). ` +
      "Check the backend API configuration."
    );
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}


function formatDate(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


function DocumentStatus({
  status,
}: {
  status: string;
}) {
  const normalized = status.toLowerCase();

  const tone = ["ready", "completed", "processed"]
    .includes(normalized)
    ? "ready"
    : ["failed", "error"].includes(normalized)
      ? "failed"
      : "pending";

  return (
    <span className={`knowledge-status ${tone}`}>
      {status}
    </span>
  );
}


function SearchResultCard({
  result,
  index,
}: {
  result: KnowledgeResult;
  index: number;
}) {
  return (
    <article className="knowledge-result">
      <div className="knowledge-result-header">
        <div className="knowledge-result-source">
          <FileText size={18} />

          <div>
            <strong>
              Result {index + 1}
            </strong>

            <span>{result.source_name}</span>
          </div>
        </div>

        {result.similarity !== null && (
          <span className="knowledge-score">
            Score: {result.similarity.toFixed(4)}
          </span>
        )}
      </div>

      <div className="knowledge-result-content">
        {result.content || (
          <em>
            No text content returned by the API.
            Check the result field mapping.
          </em>
        )}
      </div>
    </article>
  );
}


export default function KnowledgePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] =
    useState<KnowledgeTab>("documents");

  const [documents, setDocuments] =
    useState<KnowledgeDocument[]>([]);

  const [documentsLoading, setDocumentsLoading] =
    useState(true);

  const [documentsError, setDocumentsError] =
    useState<string | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [uploadMessage, setUploadMessage] =
    useState<string | null>(null);

  const [uploadError, setUploadError] =
    useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);

  const [searching, setSearching] =
    useState(false);

  const [searchError, setSearchError] =
    useState<string | null>(null);

  const [searchedQuery, setSearchedQuery] =
    useState<string | null>(null);

  const [results, setResults] =
    useState<KnowledgeResult[]>([]);


  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);

    try {
      const records = await getKnowledgeDocuments();
      setDocuments(records);
    } catch (error) {
      setDocumentsError(getErrorMessage(error));
    } finally {
      setDocumentsLoading(false);
    }
  }, []);


  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);


  async function handleUpload() {
    if (!selectedFile || uploading) {
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError("File must be 10 MB or smaller.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      await uploadKnowledgeDocument(selectedFile);

      setUploadMessage(
        "Upload request succeeded. Check document " +
        "status to confirm ingestion has completed."
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadDocuments();
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }


  async function handleSearch(event: FormEvent) {
    event.preventDefault();

    const cleanedQuery = query.trim();

    if (!cleanedQuery || searching) {
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchedQuery(null);
    setResults([]);

    try {
      const response = await searchKnowledge(
        cleanedQuery,
        topK
      );

      setSearchedQuery(response.query);
      setResults(response.results);
    } catch (error) {
      setSearchError(getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  }


  return (
    <div className="knowledge-page">
      <header className="knowledge-heading">
        <div>
          <span className="eyebrow">
            PHARMAPILOT INTELLIGENCE
          </span>

          <h1>Knowledge Base</h1>

          <p>
            Manage pharmacy documents and retrieve
            relevant information using semantic search.
          </p>
        </div>

        <div className="knowledge-heading-icon">
          <BookOpen size={27} />
        </div>
      </header>

      <div className="knowledge-tabs" role="group"
        aria-label="Knowledge sections"
      >
        <button
          className={tab === "documents" ? "active" : ""}
          onClick={() => setTab("documents")}
        >
          <FileText size={18} />
          Documents
        </button>

        <button
          className={tab === "search" ? "active" : ""}
          onClick={() => setTab("search")}
        >
          <Search size={18} />
          Semantic Search
        </button>
      </div>

      {tab === "documents" && (
        <>
          <section className="knowledge-panel">
            <div className="knowledge-section-title">
              <div>
                <h2>Upload document</h2>
                <p>
                  Add pharmacy guidelines and
                  other permitted reference files.
                </p>
              </div>

              <UploadCloud size={25} />
            </div>

            <div className="knowledge-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.md"
                aria-label="Choose knowledge document"
                onChange={(event) => {
                  setSelectedFile(
                    event.target.files?.[0] ?? null
                  );
                  setUploadError(null);
                  setUploadMessage(null);
                }}
              />

              {selectedFile && (
                <div className="knowledge-selected-file">
                  <FileText size={19} />
                  <span>{selectedFile.name}</span>

                  <button
                    aria-label="Remove selected file"
                    disabled={uploading}
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}

              <button
                className="knowledge-button primary"
                disabled={!selectedFile || uploading}
                onClick={() => void handleUpload()}
              >
                {uploading ? (
                  <LoaderCircle
                    size={17}
                    className="knowledge-spin"
                  />
                ) : (
                  <UploadCloud size={17} />
                )}

                {uploading
                  ? "Uploading..."
                  : "Upload document"}
              </button>

              <p className="knowledge-help">
                Frontend limit: 10 MB. Actual supported
                formats and server size limits must
                match the FastAPI upload endpoint.
              </p>
            </div>

            {uploadMessage && (
              <div className="knowledge-message success" role="status">
                <CheckCircle2 size={18} />
                {uploadMessage}
              </div>
            )}

            {uploadError && (
              <div className="knowledge-message error" role="alert">
                <AlertCircle size={18} />
                {uploadError}
              </div>
            )}
          </section>

          <section className="knowledge-panel">
            <div className="knowledge-section-title">
              <div>
                <h2>Document library</h2>
                <p>
                  {documentsError
                    ? "Unable to retrieve library."
                    : `${documents.length} records loaded`}
                </p>
              </div>

              <button
                className="knowledge-button secondary"
                onClick={() => void loadDocuments()}
                disabled={documentsLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {documentsError ? (
              <div className="knowledge-message error" role="alert">
                <AlertCircle size={19} />
                {documentsError}
              </div>
            ) : documentsLoading ? (
              <div className="knowledge-empty">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="knowledge-empty">
                <FileText size={30} />
                <strong>No knowledge documents found</strong>
                <p>
                  Upload a supported file to begin
                  building the knowledge library.
                </p>
              </div>
            ) : (
              <div className="knowledge-table-scroll">
                <table className="knowledge-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Chunks</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>

                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <div className="knowledge-document-name">
                            <FileText size={18} />
                            <strong>{doc.filename}</strong>
                          </div>
                        </td>
                        <td>
                          <DocumentStatus status={doc.status} />
                        </td>
                        <td>
                          {doc.chunk_count ?? "—"}
                        </td>
                        <td>
                          {formatDate(doc.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "search" && (
        <>
          <section className="knowledge-panel">
            <div className="knowledge-section-title">
              <div>
                <h2>Search pharmacy knowledge</h2>
                <p>
                  Find relevant excerpts from
                  the indexed knowledge library.
                </p>
              </div>
              <Search size={24} />
            </div>

            <form
              className="knowledge-search-form"
              onSubmit={(event) => void handleSearch(event)}
            >
              <label htmlFor="knowledge-query">
                Your question
              </label>

              <textarea
                id="knowledge-query"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                rows={3}
                placeholder="What are the guidelines for storing medicines?"
                required
              />

              <div className="knowledge-search-actions">
                <label>
                  Results
                  <select
                    value={topK}
                    onChange={(event) =>
                      setTopK(Number(event.target.value))
                    }
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </label>

                <button
                  className="knowledge-button primary"
                  type="submit"
                  disabled={searching || !query.trim()}
                >
                  {searching ? (
                    <LoaderCircle
                      size={17}
                      className="knowledge-spin"
                    />
                  ) : (
                    <Search size={17} />
                  )}

                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
            </form>
          </section>

          {searchError && (
            <div className="knowledge-message error" role="alert">
              <AlertCircle size={19} />
              {searchError}
            </div>
          )}

          {searchedQuery !== null && (
            <section className="knowledge-results-section">
              <div className="knowledge-results-heading">
                <h2>Search results</h2>
                <p>
                  Query: {searchedQuery}
                </p>
              </div>

              {results.length === 0 ? (
                <div className="knowledge-panel knowledge-empty">
                  <Search size={30} />
                  <strong>No matching knowledge found</strong>
                  <p>
                    Check whether documents are indexed,
                    or try different search terms.
                  </p>
                </div>
              ) : (
                <div className="knowledge-results-list">
                  {results.map((result, index) => (
                    <SearchResultCard
                      key={`${result.id}-${index}`}
                      result={result}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
