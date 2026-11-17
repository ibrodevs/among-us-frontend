# Verification checkpoint — Asterion 2.1

Frontend PR: https://github.com/ibrodevs/among-us-frontend/pull/6 (base ai/frontend-v2).
Backend PR: https://github.com/ibrodevs/among-us-backend/pull/7 (base ai/backend-v2).

Implemented geometry, authored interiors, materials, contours, ambient audio and visual review are described in README.md and ROOMS.md. Review route: http://localhost:3000/demo/asterion/review ; walkable map: http://localhost:3000/demo/asterion .

Verified:
- 100 backend tests passed against PostgreSQL/Redis. Backend CI succeeded at 2b21d069de4df1a70b2e704115befa567d5547e4: https://github.com/ibrodevs/among-us-backend/actions/runs/44005533642 .
- Map parity, 100 full / 52 compact interaction and spawn goals, vent network reciprocity and actual navigation segments passed. Legacy map bytes and all existing interaction/door/corridor IDs preserved.
- 11 frontend unit tests, lint, TypeScript and production build passed.
- Chromium and WebKit audio gesture/mute/mobile Retina tests passed. Desktop/CPU-throttled renderer profile is in evidence/render-profile.json. These are development-machine/emulated measurements, not physical-phone evidence.
- Visual suite captured all 21 rooms, station overview, four sectors, miniature, task/vent/door/emergency/mobile scenes and six frozen screenshot baselines. Contact sheet inspected and secondary props reworked after the first review.
- Furniture visibility fix: the former 93% opaque ray-cast overlay obscured furniture. Normal shading is now 18%; lights sabotage uses 55%. Server visibility filtering is unchanged. Dedicated browser pixel test passed; before/after visual inspection confirmed visible tables, seats and consoles. Evidence: visual/interior-visible.png.

Remaining verification:
- Final full 4- and 10-player matches, terminal/mechanics/task-panel and v1 regression on the redesigned geometry, and frontend CI acceptance are pending. Prior v2 results do not establish redesigned-map acceptance.
- The 30-client load probe was interrupted/suspended and took ~60 minutes of wall time instead of 180 seconds. It is explicitly invalid acceptance evidence and must be repeated; do not quote its latency numbers as normal performance.
- Physical-phone checks and independent code review remain pending. Neither branch was merged or deployed.

Continue with the current paired redesign branches, run the real stack and final E2E suite without rebuilding a running production server, inspect failures, repeat the load probe without suspension and update this report with observed results.
