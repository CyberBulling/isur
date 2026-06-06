"""Поиск релевантных фрагментов по запросу (BM25)."""

from typing import List, Tuple

import numpy as np
from rank_bm25 import BM25Okapi

try:
    from langchain_core.documents import Document
except ImportError:
    from langchain.schema import Document


class BM25Retriever:
    """Индекс BM25 по списку документов (чанков)."""

    def __init__(self, documents: List[Document]):
        self.documents = documents
        self.bm25 = self._init_bm25() if documents else None

    def _init_bm25(self) -> BM25Okapi:
        """Строит BM25 по токенизированному корпусу."""
        tokenized_corpus = [self._preprocess(doc.page_content) for doc in self.documents]
        return BM25Okapi(tokenized_corpus)

    def _preprocess(self, text: str) -> List[str]:
        """Приводит текст к списку токенов в нижнем регистре."""
        return text.lower().split()

    def search(self, query: str, top_n: int = 5) -> List[Tuple[str, float]]:
        """Возвращает top_n фрагментов с наибольшим score; при отсутствии совпадений — пустой список."""
        if not self.documents or self.bm25 is None:
            return []
        tokenized_query = self._preprocess(query)
        if not tokenized_query:
            return []
        scores = self.bm25.get_scores(tokenized_query)
        if float(np.max(scores)) <= 0.0:
            return []
        doc_scores = list(enumerate(scores))
        doc_scores.sort(key=lambda x: x[1], reverse=True)
        return [
            (self.documents[idx].page_content, score)
            for idx, score in doc_scores[:top_n]
        ]
