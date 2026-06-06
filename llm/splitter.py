"""Нарезка текста документов на чанки для индексации."""

from pathlib import Path
from typing import List

try:
    from langchain_core.documents import Document
except ImportError:
    from langchain.schema import Document
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

try:
    from text_extract import load_document_as_markdown
except ModuleNotFoundError:
    from .text_extract import load_document_as_markdown

HEADER_1 = "Header 1"
HEADER_2 = "Header 2"
HEADERS_TO_SPLIT_ON = [
    ("#", HEADER_1),
    ("##", HEADER_2),
    ("###", HEADER_2),
    ("####", HEADER_2),
]


class MarkdownSplitter:
    """Разбивает документ на чанки с учётом заголовков и размера фрагментов."""

    def __init__(self):
        self._md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=HEADERS_TO_SPLIT_ON
        )
        self._recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1024, chunk_overlap=0
        )

    def split_document(self, path: Path) -> List[Document]:
        """Загружает файл поддерживаемого формата и возвращает список чанков с метаданными."""
        markdown_text = load_document_as_markdown(path)
        return self._process_from_markdown(markdown_text, path)

    def _process_from_markdown(self, markdown_text: str, source_path: Path) -> List[Document]:
        """Применяет markdown- и рекурсивное разбиение, объединяет мелкие куски."""
        md_splits = self._md_splitter.split_text(markdown_text)
        recursive_splits = self._recursive_splitter.split_documents(md_splits)
        for d in recursive_splits:
            d.metadata["source"] = str(source_path.resolve())
            d.metadata["original_filename"] = source_path.name
        return self._merge_chunks(recursive_splits)

    def _merge_chunks(self, documents: List[Document]) -> List[Document]:
        """Склеивает соседние короткие чанки до лимита длины."""
        if len(documents) < 2:
            return documents
        merged = []
        current_doc = documents[0]
        for doc in documents[1:]:
            combined = f"{current_doc.page_content}\n{doc.page_content}"
            if len(combined) <= 512:
                current_doc.page_content = combined
            else:
                merged.append(current_doc)
                current_doc = doc
        merged.append(current_doc)
        for doc in merged:
            doc.metadata["source"] = str(doc.metadata.get("source", ""))
            doc.metadata["original_filename"] = str(
                doc.metadata.get("original_filename", Path(doc.metadata["source"]).name)
            )
        return merged
