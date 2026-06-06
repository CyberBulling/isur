"""RAG: индексация документов, поиск фрагментов и ответы через GigaChat."""

import argparse
import re
import time
from collections import Counter
from pathlib import Path
from typing import List

try:
    from langchain_core.documents import Document
except ImportError:
    from langchain.schema import Document

try:
    from config import RAGConfig
    from database import DatabaseManager
    from document_loader import SUPPORTED_EXTENSIONS, load_document_paths
    from llm_call import giga_chat_call
    from prompts import system_prompt, user_prompt
    from retriever import BM25Retriever
    from splitter import MarkdownSplitter
except ModuleNotFoundError:
    from .config import RAGConfig
    from .database import DatabaseManager
    from .document_loader import SUPPORTED_EXTENSIONS, load_document_paths
    from .llm_call import giga_chat_call
    from .prompts import system_prompt, user_prompt
    from .retriever import BM25Retriever
    from .splitter import MarkdownSplitter

DIALOG_GREETING = """
╔══════════════════════════════════════════════════════════════╗
║                  Помощник по благоустройству                 ║
╠══════════════════════════════════════════════════════════════╣
║  Задавайте вопросы в свободной форме.                        ║
║  :reset   — очистить историю диалога                         ║
║  exit     — выход                                            ║
╚══════════════════════════════════════════════════════════════╝
""".strip()


class RAGSystem:
    """Загружает документы в индекс, ищет релевантные чанки и вызывает LLM."""

    def __init__(self, config: RAGConfig, llm_api_key: str | None):
        self.config = config
        self.splitter = MarkdownSplitter()
        self.db = DatabaseManager(config.database_dir)
        self.retriever = None
        try:
            self.llm = giga_chat_call("GigaChat", llm_api_key)
        except Exception as e:
            self.llm = None
            print(f"[WARN] LLM недоступен: {e}")
        self._process_documents()
        self._init_retriever()
        self._history: list[tuple[str, str]] = []

    def _process_documents(self) -> None:
        """Индексирует новые файлы из document_dir (поддерживаемые расширения)."""
        processed_files = self.db.load_processed_files()
        for doc_path in load_document_paths(self.config.document_dir):
            if str(doc_path.resolve()) not in processed_files:
                try:
                    chunks = self.splitter.split_document(doc_path)
                except Exception as e:
                    print(f"[WARN] пропускаю документ {doc_path}: {e}")
                    continue
                for chunk in chunks:
                    self.db.save_chunk(chunk)

    def add_single_document(self, file_path: str | Path) -> int:
        """Добавляет один файл поддерживаемого формата в индекс и обновляет поиск."""
        doc_path = Path(file_path)
        if not doc_path.exists():
            raise FileNotFoundError(f"File {doc_path} not found")
        if doc_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Поддерживаются расширения: {sorted(SUPPORTED_EXTENSIONS)}")
        processed_files = self.db.load_processed_files()
        if str(doc_path.resolve()) in processed_files:
            print(f"Document {doc_path} already processed")
            return 0
        chunks = self.splitter.split_document(doc_path)
        for chunk in chunks:
            self.db.save_chunk(chunk)
        self._init_retriever()
        return len(chunks)

    def _history_text(self, limit_turns: int = 8) -> str:
        """Формирует текст последних реплик для промпта."""
        if not self._history:
            return "(пока пусто)"
        tail = self._history[-limit_turns:]
        return "\n".join(f"{role}: {text}" for role, text in tail)

    def reset_chat(self) -> None:
        """Очищает историю сообщений в памяти."""
        self._history.clear()

    def _local_answer(self, query: str) -> str | None:
        """Локальные ответы без LLM (например, частотность слов по всему индексу)."""
        q = query.strip().lower()
        if "самое частое слово" in q or "частое слово" in q:
            all_text = "\n".join(content for content, _ in self.db.load_chunks())
            words = re.findall(r"[0-9A-Za-zА-Яа-яЁё]+", all_text.lower())
            if not words:
                return "В базе нет текста (документы не загружены или не проиндексированы)."
            counts = Counter(words)
            word, freq = counts.most_common(1)[0]
            return f"Самое частое слово: **{word}** (встречается {freq} раз)."
        return None

    def answer_query(self, query: str, top_n: int = 5, retries: int = 2) -> str:
        """Отвечает на вопрос: сначала локальные эвристики, иначе RAG + LLM."""
        local = self._local_answer(query)
        if local is not None:
            self._history.append(("user", query))
            self._history.append(("assistant", local))
            return local
        if self.llm is None:
            return (
                "LLM недоступен (не задан GIGACHAT_AUTHORIZATION_KEY или нет сети). "
                "Локально доступна команда про «самое частое слово»."
            )
        chunks_with_scores = self.query(query, top_n)
        if not chunks_with_scores:
            return "В загруженных материалах по этому запросу ничего не найдено."
        context = "\n\n".join(
            f"[фрагмент {i + 1}]\n{chunk}"
            for i, (chunk, _) in enumerate(chunks_with_scores)
        )
        resp_str = (
            system_prompt.format(context=context, history=self._history_text())
            + "\n"
            + user_prompt.format(query=query)
        )
        for attempt in range(retries + 1):
            try:
                response = self.llm.invoke(resp_str)
                answer = response.content
                self._history.append(("user", query))
                self._history.append(("assistant", answer))
                return answer
            except Exception as e:
                if attempt < retries:
                    time.sleep(0.8 * (attempt + 1))
                    continue
                return f"Ошибка генерации ответа: {str(e)}"

    def _init_retriever(self) -> None:
        """Пересобирает BM25 по всем чанкам из БД."""
        documents = [
            Document(page_content=content, metadata=metadata)
            for content, metadata in self.db.load_chunks()
        ]
        self.retriever = BM25Retriever(documents)

    def query(self, question: str, top_n: int = 10) -> List[tuple]:
        """Возвращает список (текст_чанка, score) по запросу."""
        if self.retriever is None:
            return []
        return self.retriever.search(question, top_n)


_HERE = Path(__file__).resolve().parent
config = RAGConfig(
    document_dir=str(_HERE / "test_docs"),
    database_dir=str(_HERE / "test_database"),
)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--top-n", type=int, default=5)
    parser.add_argument("--query", type=str, default=None)
    args = parser.parse_args()

    rag = RAGSystem(config, None)

    if args.query:
        print(rag.answer_query(args.query, top_n=args.top_n))
        raise SystemExit(0)

    print(DIALOG_GREETING)
    while True:
        try:
            q = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not q:
            continue
        if q in {"exit", "quit"}:
            break
        if q == ":reindex":
            rag._process_documents()
            rag._init_retriever()
            print("Переиндексация завершена.")
            continue
        if q == ":reset":
            rag.reset_chat()
            print("История чата очищена.")
            continue
        print(rag.answer_query(q, top_n=args.top_n))
