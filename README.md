# CREWMATE X — Frontend

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

**Current state:** lobby and full real-time match implemented on review branches. Human review, integration and production deployment remain separate gates.


## Verify the real match
`npm ci`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run start`. The sibling backend must run PostgreSQL, Redis, Daphne on8000 and `run_game_worker`. Then run `npx playwright install chromium` and `npm run test:e2e`. Tests use real APIs and WebSockets; no mocked match events. 4- and10-player cases complete through voting, including movement and reconnect. `/demo` is explicitly local-only. Screenshots and sanitized match reports go to ignored `test-results/`; approved evidence is copied to `docs/verification/`. Do not upload Playwright traces containing guest auth frames. Nunito is self-hosted under SIL OFL; robot SVG is original. See [WS-EVENTS](docs/WS-EVENTS.md) and backend `docs/DEPLOYMENT.md` for runtime and deployment settings. CI compares shared map JSON against `ai/backend-gameplay`; retarget to main after reviewed integration.
