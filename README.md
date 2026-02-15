# TuneTrip

TuneTrip is a full-stack smart ride compatibility platform that matches travelers by route similarity and shared interests.

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + MongoDB (Mongoose)
- Auth: JWT + bcrypt

## Project Structure
- `server/` Express API, MongoDB models, auth middleware, matching utilities
- `client/` React SPA for home, auth, dashboard, posting/searching rides, and ride requests

## Environment Variables
Backend (`server/.env`):

```bash
PORT=5000
MONGO_URI=your_mongodb_atlas_connection
JWT_SECRET=super_secret
CLIENT_URL=http://localhost:5173
```

Frontend (`client/.env`):

```bash
VITE_API_URL=http://localhost:5000/api
```

## Run Locally

```bash
# backend
cd server
npm install
npm run dev

# frontend (new terminal)
cd client
npm install
npm run dev
```


## Auth Troubleshooting
- Ensure backend is running on `http://localhost:5000` before login/register.
- Ensure frontend has `VITE_API_URL=http://localhost:5000/api` in `client/.env`.
- Ensure backend `.env` has a valid `JWT_SECRET`; missing secret will fail auth routes.
- If using `127.0.0.1:5173` in browser, backend CORS now allows both `localhost` and `127.0.0.1`.

## API Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/rides` (protected)
- `POST /api/rides/search` (protected)
- `POST /api/requests` (protected)
- `GET /api/requests/sent` (protected)
- `GET /api/requests/received` (protected)
- `PATCH /api/requests/:id/status` (protected)

## Deployment
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
