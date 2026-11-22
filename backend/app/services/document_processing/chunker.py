import tiktoken

from app.core.config import get_settings


class DocumentChunker:
    def __init__(self):
        self.settings = get_settings()

        self.encoding = tiktoken.get_encoding("cl100k_base")

    def chunk(self, text: str) -> list[dict]:

        tokens = self.encoding.encode(text)

        chunk_size = self.settings.RAG_CHUNK_SIZE
        overlap = self.settings.RAG_CHUNK_OVERLAP

        if overlap >= chunk_size:
            raise ValueError("Chunk overlap must be smaller than chunk size.")

        chunks = []
        start = 0
        position = 0

        while start < len(tokens):
            end = min(
                start + chunk_size,
                len(tokens),
            )

            chunk_tokens = tokens[start:end]

            content = self.encoding.decode(chunk_tokens).strip()

            if content:
                chunks.append(
                    {
                        "position": position,
                        "content": content,
                        "token_count": len(chunk_tokens),
                    }
                )

                position += 1

            if end >= len(tokens):
                break

            start = end - overlap

        return chunks
