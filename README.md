# Crew Mission — Frontend

Multiplayer 2D social-deduction game inspired by the genre of Among Us. Original artwork and UI only. Stack: **Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4**.

## Quick start

1. Install Node.js 20.9+ and run `npm install`.
2. Copy `.env.example` to `.env.local`; set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.
3. Start the Django backend, then run `npm run dev`.
4. Open http://localhost:3000.

## Commands
- `npm run dev` — local development
- `npm run typecheck` — TypeScript validation
- `npm run lint` — ESLint
- `npm run build` — production build

## Responsibility and workflow
- Ibro — `feature/ibro-lobby-ui`: landing, nickname/guest session, rooms and lobby, API client
- Bayel — `feature/bayel-gameplay-ui`: game board, movement visuals, tasks, HUD, WebSocket client, meeting/voting UI

Read [Architecture](docs/ARCHITECTURE.md), [API contract](docs/API-CONTRACT.md), [contribution workflow](CONTRIBUTING.md) and the individual specs in `docs/`. Main is the integration branch. Do not push developer features directly to main. PRs are made only after local checks and review.

**Current state:** foundational pages and network utilities only; gameplay, complete lobby UX and live synchronization are assigned work, not finished functionality.
