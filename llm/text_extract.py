"""Извлечение текста из файлов разных форматов для последующей нарезки на чанки."""

from __future__ import annotations

from pathlib import Path

import docx
from bs4 import BeautifulSoup
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
import zipfile
from pypdf import PdfReader


def load_document_as_markdown(path: Path) -> str:
    """
    Читает файл по расширению и возвращает текст в виде markdown
    (заголовок с именем файла + содержимое).
    """
    ext = path.suffix.lower()
    if ext == ".docx":
        return _docx_to_markdown(path)
    if ext in (".txt", ".md", ".markdown"):
        body = path.read_text(encoding="utf-8", errors="replace")
        return f"# {path.stem}\n\n{body}"
    if ext == ".pdf":
        body = _read_pdf(path)
        return f"# {path.stem}\n\n{body}"
    if ext in (".html", ".htm"):
        body = _read_html(path)
        return f"# {path.stem}\n\n{body}"
    if ext in (".rtf", ".odt", ".doc"):
        body = _read_unstructured(path)
        if not body.strip():
            raise ValueError(f"Не удалось извлечь текст из {path}")
        return f"# {path.stem}\n\n{body}"
    raise ValueError(f"Неподдерживаемый формат: {ext}")


def _docx_to_markdown(docx_path: Path) -> str:
    """Конвертирует DOCX в markdown-подобную строку с заголовками по стилям."""
    lines = [f"# {docx_path.stem}"]
    try:
        doc = docx.Document(docx_path)
    except zipfile.BadZipFile as e:
        raise ValueError(
            f"Файл {docx_path} не является корректным .docx. "
            "Сохраните документ как Word 2007+ (.docx)."
        ) from e
    for paragraph in doc.paragraphs:
        if paragraph.alignment == WD_PARAGRAPH_ALIGNMENT.CENTER:
            lines.append(f"## {paragraph.text}\n")
        elif paragraph.style.name.startswith("Heading"):
            level = int(paragraph.style.name.split()[-1])
            lines.append(f"{'#' * (level + 1)} {paragraph.text}\n")
        else:
            lines.append(paragraph.text + "\n")
    return "\n".join(lines)


def _read_pdf(path: Path) -> str:
    """Извлекает текст из PDF."""
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _read_html(path: Path) -> str:
    """Извлекает текст из HTML."""
    raw = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(raw, "html.parser")
    return soup.get_text(separator="\n")


def _read_unstructured(path: Path) -> str:
    """Пробует извлечь текст через unstructured (RTF, ODT, старый DOC и др.)."""
    try:
        from unstructured.partition.auto import partition
    except ImportError:
        return ""
    try:
        elements = partition(filename=str(path))
        return "\n\n".join(str(el) for el in elements)
    except Exception:
        return ""
