# Running v2 verification

Use the paired backend branch `ai/backend-v2`. Start PostgreSQL, Redis, Daphne and the durable clock; migrate first. Build frontend and serve it on localhost:3000. Never run a new build while exercising an older running production server: restart after the build so its manifest and chunks match.

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `npx playwright test e2e/asterion.spec.ts`: 4/10 real browser guests, compact/full maps, chosen color, touch movement, task UI, reconnect, chat and crew voting victory.
- `npx playwright test e2e/asterion-mechanics.spec.ts`: real walks and actions for vents, repairs, closed-door collision, kills, ghost task, reports, isolated chat, Skip/parity, crew task victory and oxygen timeout. No DB positioning fixtures or request mocks.
- `npx playwright test e2e/audio-performance.spec.ts`: Chromium/WebKit gesture/mute persistence and separately labeled Chromium desktop/CPU-throttled profiles. Install both browsers first.
- `CREW_UI_FIXTURES=true npx playwright test e2e/task-panels.spec.ts`: tests all 20 panels against real Django validators. Explicitly modifies only the test match's own assignment/position between types. Requires a disposable local/test PostgreSQL database. Set CREW_BACKEND_PYTHON to the Python executable; in CI this is `python` with checkout at `backend`, locally it defaults to the sibling backend venv. This suite is not presented as an unseeded station traversal.
- `npx playwright test e2e/asterion-terminals.spec.ts`: camera authorization/switching, comms repair, admin aggregation, delayed vitals and oxygen codes.
- Existing `e2e/match.spec.ts` explicitly chooses map v1 and remains the legacy regression suite.

Guest throttling stays enabled. Large guest batches intentionally wait for the real rate-limit window; do not disable production throttles to make tests pass. Browser profiles and load results must state environment, duration, client count, sample method and limitations. Save only reports and screenshots, never guest tokens.
