# MVP architecture and boundaries

The team is implementing an original 2D multiplayer social-deduction experience inspired by the genre; **do not copy official characters, textures, sounds or names into the UI**.

## MVP
- 4–10 players per private room, 6-character uppercase room code, guest nickname (2–16 characters).
- Host creates the room, players join by code, host starts at 4+ players.
- One 2D spaceship map; player motion via WASD/arrows, no collision cheating.
- Crew members complete 3 short tasks each; impostor(s) sabotage by eliminating crew, kill cooldown 25s.
- Dead players cannot vote or finish tasks, can spectate; dead/role information not disclosed prematurely.
- Report body or press emergency meeting; discussion/countdown, one vote per alive player, skip vote; tie means no ejection.
- Crew wins when all tasks are completed or all impostors are ejected. Impostors win at parity with living crew.
- Server is authoritative for roles, movement, tasks, kills, meetings, votes, game result. Frontend is display and input only.

## Shared boundaries
- Ibro: landing, guest identity persistence, room screens, REST client, form UX.
- Bayel: real-time game screens, shared WebSocket client, canvas rendering and visuals; cannot decide a game winner.
- Kutman: guest tokens, room/player entities, room CRUD/permissions, REST/DB validation.
- Ilyar: live connections, match state machine, authoritative gameplay/rules, WebSocket events.

## Integration contract
Frontend uses `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`. REST JSON uses snake_case. A guest token is sent in `Authorization: Guest <token>`. WebSocket uses `ws(s)://host/ws/rooms/<ROOM_CODE>/` and authenticates via the first message `{"type":"auth","token":"..."}` — do not put tokens into URLs.

See [API contract](API-CONTRACT.md). Kutman/Ilyar agree on interfaces *before* modifying shared Django models; Ibro/Bayel agree on shared types in `src/lib/types.ts`.

## Not in first MVP
Public matchmaking, email/password, skins/shop, voice chat, 3D rendering, moderation infrastructure, scalable multi-region deployment, advanced anti-cheat.
