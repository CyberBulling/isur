"""Настройки путей к каталогу документов и базе чанков."""

from pathlib import Path


class RAGConfig:
    """Пути к папке с исходными файлами и к папке индекса (chunks + metadata)."""

    def __init__(self, document_dir: str, database_dir: str):
        self.document_dir = Path(document_dir)
        self.database_dir = Path(database_dir)
        self.database_dir.mkdir(parents=True, exist_ok=True)
