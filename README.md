<img width="640" height="449" alt="oop-draft-landing" src="https://github.com/user-attachments/assets/aaf02eee-ec02-4840-9e3c-e6c113b0ef17" />
# Svelte + PocketBase Boilerplate

SvelteKit 5 frontend with PocketBase backend, ready for Railway deployment.

## Project Structure

```
├── src/                  # SvelteKit frontend
│   ├── lib/              # Shared components and utilities
│   └── routes/           # Pages and API routes
├── backend/              # PocketBase backend
│   ├── pb_migrations/    # Database migrations
│   ├── pb_hooks/         # Custom hooks
│   ├── start.sh          # Local dev script
│   └── Dockerfile        # Railway deployment
└── static/               # Static assets
```

## Local Development

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
./start.sh
```

PocketBase admin UI: http://localhost:8090/_/

## Deployment (Railway)

1. Create two services in Railway from this repo
2. Frontend: Set root directory to `/` 
3. Backend: Set root directory to `/backend`

## Stack

- **Frontend**: SvelteKit 5, TypeScript, Zod
- **Backend**: PocketBase
- **Deployment**: Railway
