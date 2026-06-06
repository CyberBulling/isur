# Backend / Windows запуск

## 1) Установка зависимостей
```powershell
cd backend
npm install
npm run setup:python
```

## 2) Запуск всего проекта (Node + LLM)
```powershell
npm run start:all
```

- Сайт: `http://localhost:5000`
- LLM API: `http://localhost:8000/chat`

## Важно
Если в системе включены прокси `HTTP_PROXY/HTTPS_PROXY` с `socks5://...`, `pip` может падать.
Перед `npm run setup:python` можно временно убрать их:
```powershell
Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
```
