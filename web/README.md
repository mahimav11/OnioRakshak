# OnioRakshak web

React (Vite) + Tailwind front end for OnioRakshak. It talks to the FastAPI
service in `../ml/api` through the `/api` proxy.

## Run
1. Start the API (from the `ml` folder): `uvicorn api.main:app --port 8000`
2. In this folder: `npm install` (first time only), then `npm run dev`
3. Open http://localhost:5173

Needs Node 20.19+ or 22.12+ (check with `node -v`).

## Structure
- `src/index.css` design tokens (colors, fonts)
- `src/locales/` English, Marathi, Hindi strings
- `src/components/` layout, language switcher, API status, logo
- `src/pages/` one file per page
- `src/lib/api.js` helpers for calling the API
