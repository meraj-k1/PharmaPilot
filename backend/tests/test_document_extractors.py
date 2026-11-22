import pytest

from app.core.exceptions.base import AppException
from app.services.document_processing.extractors import (
    extract_document,
    normalize_text,
)


def test_extract_txt():
    content = b"PharmaPilot knowledge document."

    result = extract_document(
        "guide.txt",
        content,
    )

    assert result == "PharmaPilot knowledge document."


def test_normalize_text():
    result = normalize_text("Medicine   storage\r\n\r\n\r\nGuidelines")

    assert result == "Medicine storage\n\nGuidelines"


def test_unsupported_file():
    with pytest.raises(AppException):
        extract_document(
            "malware.exe",
            b"test",
        )


def test_empty_txt():
    with pytest.raises(AppException):
        extract_document(
            "empty.txt",
            b"",
        )
