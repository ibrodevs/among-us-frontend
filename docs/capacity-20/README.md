# CREWMATE X — capacity and release checks

20 guests share one room, with 3 host-selected impostors and 17 crewmates. The host can instead select 1 or 2 impostors; the server enforces minimum rosters 4/7/10, immutable settings after start, capacity and permissions.

The lobby displays 20 avatars/connection statuses, synchronizes host settings, and enables Start only for a valid roster. Twenty colors combine chest markings and antenna shapes. Meeting cards show avatars, alive/dead state and vote confirmation.

## Reproduce

Run the sibling backend with real PostgreSQL, Redis, Daphne and `run_game_worker`. Build/start this frontend, then:

- `node scripts/capacity-20.mjs`: real 20-client join, ROOM_FULL, private roles/tasks, movement, reconnect, chat, 20 skip votes and meeting resume. Includes actual browser screenshots `lobby-20.png` and `meeting-20.png`.
- `CREW_SOAK_SECONDS=1800 node scripts/load-20.mjs`: 20 active bots drive real movement, tasks, vents/travel, sabotages/repairs, kills/report, meetings/votes, completion and reconnect. No fabricated positions or database fixtures. It rejects missing scenario coverage or unexpected errors.
- `npm run test:e2e`: browser mechanics, tasks, map/interior, legacy and current matches, plus synchronized host settings.

Reports contain aggregate timing, rule rejections and resource samples. No auth tokens, payload dumps or guest identities are committed. Expected rule rejections from concurrent actions are distinct from unexpected errors.

Local measurements do not certify Northflank performance; repeat the probe against the actual deployed stack. Use `CREW_API_URL=https://your-api` for the soak. Browser tests require their documented local origins/ports.

For a deployed check set `CREW_API_URL=https://<backend>` and `CREW_FRONTEND_URL=https://<frontend>`; the latter must match an allowed backend origin. Local process/clock metrics apply only on the machine running those services.
