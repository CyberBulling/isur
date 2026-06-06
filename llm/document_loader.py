"""Поиск путей к поддерживаемым документам в каталоге."""

from pathlib import Path

SUPPORTED_EXTENSIONS = {
    ".docx",
    ".txt",
    ".md",
    ".markdown",
    ".pdf",
    ".html",
    ".htm",
    ".rtf",
    ".odt",
    ".doc",
}


def load_document_paths(document_dir: Path) -> list[Path]:
    """Возвращает список файлов поддерживаемых типов (рекурсивно)."""
    out: list[Path] = []
    for p in document_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            out.append(p)
    return sorted(out)
