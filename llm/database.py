"""Хранение чанков и метаданных на диске (CSV + текстовые файлы)."""

import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

try:
    from langchain_core.documents import Document
except ImportError:
    from langchain.schema import Document


class DatabaseManager:
    """Управляет каталогом chunks и файлом metadata.csv."""

    def __init__(self, database_dir: Path):
        self.chunks_dir = database_dir / "chunks"
        self.metadata_file = database_dir / "metadata.csv"
        self._counter: Dict[str, int] = {}
        self.chunks_dir.mkdir(parents=True, exist_ok=True)
        self._init_metadata()
        self._init_counter()

    def _init_metadata(self) -> None:
        """Создаёт metadata.csv с заголовком, если файла ещё нет."""
        if not self.metadata_file.exists():
            with open(self.metadata_file, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(["chunk_id", "document_path", "metadata"])

    def _init_counter(self) -> None:
        """Восстанавливает максимальные номера чанков по путям из metadata.csv."""
        if not self.metadata_file.exists():
            return
        with open(self.metadata_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            try:
                next(reader)
            except StopIteration:
                return
            for row in reader:
                if len(row) >= 2:
                    chunk_id, doc_path = row[0], row[1]
                    m = re.match(r"^(\d+)_chunk_", chunk_id)
                    if m:
                        n = int(m.group(1))
                        self._counter[doc_path] = max(self._counter.get(doc_path, 0), n)

    def _doc_key(self, source_file: Path) -> str:
        """Стабильный ключ документа для счётчика чанков."""
        return str(source_file.resolve())

    def _get_next_chunk_number(self, source_file: Path) -> int:
        """Возвращает следующий порядковый номер чанка для данного файла."""
        key = self._doc_key(source_file)
        self._counter[key] = self._counter.get(key, 0) + 1
        return self._counter[key]

    def load_processed_files(self) -> Set[str]:
        """Множество абсолютных путей документов, уже попавших в метаданные."""
        processed: Set[str] = set()
        if self.metadata_file.exists():
            with open(self.metadata_file, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                try:
                    next(reader)
                except StopIteration:
                    return processed
                for row in reader:
                    if len(row) >= 2:
                        processed.add(row[1])
        return processed

    def save_chunk(self, chunk: Document) -> str:
        """Сохраняет текст чанка и строку в metadata.csv; возвращает имя файла чанка."""
        source_path = Path(chunk.metadata.get("source", "unknown")).resolve()
        chunk_number = self._get_next_chunk_number(source_path)
        sid = hashlib.sha256(self._doc_key(source_path).encode()).hexdigest()[:12]
        filename = f"{chunk_number}_chunk_{sid}.txt"
        chunk_file = self.chunks_dir / filename
        chunk_file.write_text(chunk.page_content, encoding="utf-8")
        metadata = {
            "source": str(source_path),
            "original_filename": source_path.name,
            **{
                k: v
                for k, v in chunk.metadata.items()
                if k not in ("source", "original_filename")
            },
        }
        with open(self.metadata_file, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [filename, str(source_path), json.dumps(metadata, ensure_ascii=False)]
            )
        return filename

    def load_chunks(self) -> List[Tuple[str, dict]]:
        """Загружает все чанки из metadata и файлов chunks/."""
        chunks: List[Tuple[str, dict]] = []
        if not self.metadata_file.exists():
            return chunks
        with open(self.metadata_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            try:
                next(reader)
            except StopIteration:
                return chunks
            for row in reader:
                if len(row) >= 3:
                    chunk_id, _doc_path, metadata_json = row
                    chunk_file = self.chunks_dir / chunk_id
                    if chunk_file.exists():
                        content = chunk_file.read_text(encoding="utf-8")
                        chunks.append((content, json.loads(metadata_json)))
        return chunks
