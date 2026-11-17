# Asterion 2.1 map redesign

Stacked branches: `ai/frontend-map-redesign` from frontend v2 at `243d632`; paired `ai/backend-map-redesign` from backend v2 at `34e41d3`. Backend PR: https://github.com/ibrodevs/among-us-backend/pull/7 . No deployment/merge performed.

## Implementation

- `scripts/asterion_rooms.py` in backend contains 21 authored room passports. Floor unions compile into one collision map; wall outlines omit actual doorway mouths. There are 133 prop groups with explicit collision flags, 12 floor materials, local lights and 21 audio profiles.
- Renderer modules `asterion/RoomRenderer.ts` and `StationFixtures.ts` separate materials, props, corridors, frames, interaction families and culled activity from camera/actors/occlusion. Static layers use the existing bounded 512px chunk cache. The test overview uses one low-resolution cached atlas, never a full-resolution map per frame.
- Major machines have separate silhouettes and interiors. Medical/quarters/airlock/workshop partitions create actual occlusion and routes. The reactor core and Nexus table occupy the center; spawns and navigation anchors avoid furniture.
- Miniature uses the same composite floor parts and exposed contours, with room/sector focus, zoom and drag. Tasks retain private assignment markers; emergencies and closed gates come from real server snapshots.
- Ambient profiles use an original oscillator/filtered-noise bed and smooth gain/frequency transitions, scoped to the current room. Existing music, mute/volume/gesture unlock are retained.
- Existing task, vent, door, terminal, corridor and emergency panel identifiers and vent links are preserved. The 40 stations, 20 task types, 20 vents, compact/full configuration and legacy v1 remain.

## Local visual review

Build with `MAP_REVIEW_ENABLED=true npm run build`, then start the frontend. Open `/demo/asterion/review` for frozen room/sector/overview and task/vent/door/emergency scenes. The route returns 404 without explicit test/development opt-in. `/demo/asterion` is the normal walkable offline map; real multiplayer remains `/game/[code]`.

`MAP_REVIEW_ENABLED=true npx playwright test e2e/map-redesign.spec.ts` captures all 21 rooms, station and sector overviews, miniature, key scenes and mobile viewport. Six stored screenshot baselines detect regressions; contact sheet and gallery are supplied under `evidence/visual/` after verification.

## Verification

100 Django tests passed on PostgreSQL/Redis. Shared maps match byte-for-byte. Full mode: 100 approach/spawn goals; compact: 52. See paired backend evidence for actual collision checks and walking measurements. At speed 220, calculated Nexus→critical panels takes 7.64–9.45s; worst room-anchor→task is 18.36s compact / 29.27s full. These are collision-grid estimates with open dynamic doors, not measured human reaction/network time; timers were not changed.

Final browser, visual, load and CI outcomes are recorded in REPORT.md. Emulated mobile and desktop WebKit cannot establish physical-phone performance. Geometry v2.1 must be rolled out to frontend/backend together between matches; no production migration is performed.
