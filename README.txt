
SpySignal v2 — Simplified Signal-style E2EE messenger

Backend:
- FastAPI + SQLite (SQLAlchemy)
- Endpoints:
  - POST /api/users/register
  - GET  /api/users/search?q=...
  - GET  /api/users/{id}
  - POST /api/messages/
  - GET  /api/messages/history?user_id=...&peer_id=...
  - GET  /health

Frontend:
- static/index.html
- static/app.js
- static/style.css

Railway:
- Set root of repo to this folder
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port 8080`
