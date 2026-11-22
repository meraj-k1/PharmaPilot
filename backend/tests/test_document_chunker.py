from app.services.document_processing.chunker import DocumentChunker


def test_chunker_returns_chunks():
    chunker = DocumentChunker()

    text = "Pharmacy storage guidelines. " * 500

    chunks = chunker.chunk(text)

    assert len(chunks) > 1


def test_chunk_positions_are_sequential():
    chunker = DocumentChunker()

    text = "Medicine inventory information. " * 500

    chunks = chunker.chunk(text)

    positions = [chunk["position"] for chunk in chunks]

    assert positions == list(range(len(chunks)))


def test_chunk_token_count_is_positive():
    chunker = DocumentChunker()

    chunks = chunker.chunk("PharmaPilot pharmacy knowledge document.")

    assert all(chunk["token_count"] > 0 for chunk in chunks)


def test_empty_document_returns_no_chunks():
    chunker = DocumentChunker()

    assert chunker.chunk("") == []
