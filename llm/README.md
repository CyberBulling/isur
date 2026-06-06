## Установка

```bash
cd /path/to/auto_doc_search
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Запуск в терминале

```bash
source .venv/bin/activate
export GIGACHAT_AUTHORIZATION_KEY='MDE5Y2Y4MmUtMzhlZS03YWQ0LWI2OGEtNjA0Y2YyY2IxNDFiOjBiYWI5ZjA0LTVlYmQtNGZlYS05ZDZhLWEyNzllMGYyMmM5MQ=='
python rag_system.py
```

## HTTP API для сайта

Поднимает сервер с CORS (по умолчанию `*`; задайте `CORS_ORIGINS=https://mysite.ru,https://www.mysite.ru`).

```bash
source .venv/bin/activate
export GIGACHAT_AUTHORIZATION_KEY='MDE5Y2Y4MmUtMzhlZS03YWQ0LWI2OGEtNjA0Y2YyY2IxNDFiOjBiYWI5ZjA0LTVlYmQtNGZlYS05ZDZhLWEyNzllMGYyMmM5MQ=='
uvicorn api:app --host 0.0.0.0 --port 8000
```

- `GET /health` — проверка работоспособности.
- `POST /chat` — JSON: `{"question": "...", "top_n": 5}` → `{"answer": "..."}`.

Пример с фронта (fetch):

```javascript
const r = await fetch("http://localhost:8000/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "Какие показатели в отчёте?", top_n: 5 }),
});
const { answer } = await r.json();
```

### Продакшен

- За **nginx** / **Caddy**: reverse proxy на `127.0.0.1:8000`, TLS на границе.
- Ограничить CORS реальным доменом сайта.
- Хранить `GIGACHAT_AUTHORIZATION_KEY` в секретах (env, Vault), не в коде.

## Переиндексация

После замены файлов в `test_docs/` в интерактивном режиме выполните `:reindex` или удалите `test_database/metadata.csv` и `test_database/chunks/*` и запустите снова.
