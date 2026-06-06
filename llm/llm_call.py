import os
import sys
from pathlib import Path
from typing import Optional

from langchain_gigachat import GigaChat


def _load_env_value(key: str) -> Optional[str]:
    value = os.getenv(key)
    if value:
        return value

    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return None

    for line in env_path.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#") or "=" not in entry:
            continue
        current_key, current_value = entry.split("=", 1)
        current_key = current_key.strip()
        current_value = current_value.strip().strip("\"'")
        if current_key == key:
            os.environ[key] = current_value
            return current_value
    return None


def giga_chat_call(model_name: str, authorization_key: Optional[str] = None) -> GigaChat:
    """
    Инициализация GigaChat через SDK.

    В `credentials` нужно передавать **Authorization key** (base64-строку из личного кабинета Studio),
    а не access_token. SDK сам получает и обновляет access_token через /api/v2/oauth.
    """
    if sys.version_info >= (3, 14):
        raise RuntimeError(
            "Python 3.14+ не поддерживается текущими зависимостями (pydantic.v1 / gigachat). "
            "Используйте Python 3.12 или 3.13 и пересоздайте виртуальное окружение."
        )

    credentials = authorization_key or _load_env_value("GIGACHAT_AUTHORIZATION_KEY")
    if not credentials:
        raise RuntimeError(
            "Не задан Authorization key для GigaChat. "
            "Установите переменную окружения GIGACHAT_AUTHORIZATION_KEY (base64 из поля Authorization Key)."
        )

    return GigaChat(
        model=model_name,
        credentials=credentials,
        scope=os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS"),
        verify_ssl_certs=os.getenv("GIGACHAT_VERIFY_SSL_CERTS", "0") == "1",
        temperature=float(os.getenv("GIGACHAT_TEMPERATURE", "1")),
        profanity_check=os.getenv("GIGACHAT_PROFANITY_CHECK", "0") == "1",
    )
