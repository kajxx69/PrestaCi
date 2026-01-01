# PrestaCI Monorepo

This repository contains two apps:

- `frontend/`: Vite + React (PWA) mobile-first UI
- `backend/`: Node.js + Express + MySQL API

## Getting Started

### Backend
1. Copy `backend/.env.example` to `backend/.env` and set your DB credentials.
2. Create database schema:
   - Import `backend/schema.sql` via MySQL Workbench or CLI.
3. Install and run:
```bash
cd backend
npm install
npm run dev
```
The API will be available at `http://localhost:4000`. Health check: `GET /api/health`.

### Frontend
1. Install and run:
```bash
cd frontend
npm install
npm run dev
```
Vite dev server runs on `http://localhost:5173` by default and proxies `/api` to `http://localhost:4000` (see `frontend/vite.config.ts`).

## Notes
- Service Worker and PWA manifest live in `frontend/public/`.
- UI will be refactored progressively to call the backend API instead of local mocks.
- Development flow: run backend first, then frontend.
