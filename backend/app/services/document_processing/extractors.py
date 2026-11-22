import io
import re
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from app.core.exceptions.base import AppException

SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
}


def normalize_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))

    if reader.is_encrypted:
        raise ValueError("Encrypted PDF is not supported.")

    pages = []

    for page in reader.pages:
        pages.append(page.extract_text() or "")

    return "\n\n".join(pages)


def extract_docx(content: bytes) -> str:
    document = Document(io.BytesIO(content))

    paragraphs = [
        paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()
    ]

    return "\n".join(paragraphs)


def extract_txt(content: bytes) -> str:
    return content.decode("utf-8-sig")


def extract_document(
    filename: str,
    content: bytes,
) -> str:

    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise AppException(
            message="Unsupported document format.",
            status_code=415,
            error_code="UNSUPPORTED_DOCUMENT_FORMAT",
        )

    try:
        if extension == ".pdf":
            text = extract_pdf(content)

        elif extension == ".docx":
            text = extract_docx(content)

        else:
            text = extract_txt(content)

        text = normalize_text(text)

        if not text:
            raise ValueError("Document contains no extractable text.")

        return text

    except AppException:
        raise

    except Exception as exc:
        raise AppException(
            message="Unable to extract document text.",
            status_code=422,
            error_code="DOCUMENT_EXTRACTION_FAILED",
        ) from exc
