import logging

import httpx

from app.core.config import get_settings
from app.core.exceptions.base import AppException

logger = logging.getLogger(__name__)


class TEIEmbeddingService:
    def __init__(self):
        self.settings = get_settings()

    async def embed(
        self,
        texts: list[str],
        prefix: str,
    ) -> list[list[float]]:

        if not texts:
            return []

        if prefix not in {"query", "passage"}:
            raise ValueError("Unsupported embedding prefix.")

        prepared = [f"{prefix}: {text.strip()}" for text in texts]

        if any(not text.split(": ", 1)[-1] for text in prepared):
            raise ValueError("Embedding text cannot be empty.")

        url = f"{self.settings.EMBEDDING_SERVICE_URL.rstrip('/')}/embed"

        payload = {
            "inputs": prepared,
            "normalize": True,
        }

        timeout = httpx.Timeout(
            timeout=60.0,
            connect=10.0,
        )

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
            ) as client:
                response = await client.post(
                    url,
                    json=payload,
                )

                response.raise_for_status()
                vectors = response.json()

            if not isinstance(vectors, list):
                raise TypeError("Invalid embedding response.")

            if len(vectors) != len(texts):
                raise ValueError("Embedding response count mismatch.")

            dimensions = self.settings.EMBEDDING_DIMENSIONS

            validated = []

            for vector in vectors:
                if not isinstance(vector, list) or len(vector) != dimensions:
                    raise ValueError("Invalid embedding dimensions.")

                if any(not isinstance(value, (int, float)) for value in vector):
                    raise ValueError("Embedding contains invalid values.")

                validated.append([float(value) for value in vector])

            return validated

        except httpx.HTTPStatusError as exc:
            logger.exception("TEI returned an HTTP error")

            raise AppException(
                message="Embedding service rejected the request.",
                status_code=502,
                error_code="EMBEDDING_PROVIDER_ERROR",
            ) from exc

        except (httpx.HTTPError, ValueError) as exc:
            logger.exception("Embedding service failure")

            raise AppException(
                message="Unable to generate document embeddings.",
                status_code=502,
                error_code="EMBEDDING_ERROR",
            ) from exc

    async def embed_query(
        self,
        text: str,
    ) -> list[float]:

        vectors = await self.embed(
            [text],
            prefix="query",
        )

        return vectors[0]

    async def embed_passages(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        return await self.embed(
            texts,
            prefix="passage",
        )
