# API and WebSocket Contract v1 (frozen for feature branches)

## REST base and error convention
`/api/v1/`, JSON payloads, UTC ISO 8601 timestamps, UUID string IDs; failures `{"detail":"human-readable text"}` and conventional HTTP statuses (400 validation, 401 auth, 403 permission, 404 unknown room, 409 conflict). All endpoints except guest creation require `Authorization: Guest <signed-token>`. CORS must permit the configured frontend origin. Never log token values.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `guests/` | `{"nickname":"Ibro"}` | `{"player_id":"uuid","nickname":"Ibro","token":"..."}` 201 |
| POST | `rooms/` | `{"max_players":10}` | Room 201 |
| POST | `rooms/join/` | `{"code":"AB12CD"}` | Room 200 |
| GET | `rooms/{code}/` | none | Room 200 |
| POST | `rooms/{code}/leave/` | none | 204 |
| POST | `games/{code}/start/` | none | Room 200, host only, min 4; Ilyar owns |
| GET | `health/` | none | `{"status":"ok"}` 200 |

Room shape: `{"id":"uuid","code":"AB12CD","status":"waiting","min_players":4,"max_players":10,"host_player_id":"uuid","players":[{"id":"uuid","nickname":"Ibro","is_host":true,"is_connected":false}],"created_at":"..."}`. Never serialize hidden roles or secret task assignments in public REST room details. Room join duplicate is idempotent; join after start or full returns 409. Disconnect does not permanently remove a participant; explicit leave does.

## Real time (Ilyar implements; Bayel integrates)
Connect `/ws/rooms/{code}/`. First client frame must be `{"type":"auth","token":"<signed-token>"}`; server responds `{"type":"auth.ok","player_id":"uuid"}` or `{"type":"error","code":"UNAUTHORIZED","detail":"..."}` and closes. All subsequent commands and events use a `type` discriminant. Coordinates are pixels on logical 1600×900 map.

Client → server:
- `{"type":"player.move","seq":12,"direction":{"x":1,"y":0}}` every 50–100ms (server computes allowed displacement; clamp vector).
- `{"type":"task.complete","task_id":"uuid"}` (server validates location/role/state and prevents duplicate completion).
- `{"type":"player.kill","target_player_id":"uuid"}` (server validates impostor, range, cooldown and roles).
- `{"type":"body.report","body_id":"uuid"}`.
- `{"type":"meeting.call"}` (limit per player).
- `{"type":"vote.cast","target_player_id":"uuid-or-null"}` (null = skip; once per meeting).
- `{"type":"ping"}`.

Server → client:
- `auth.ok`, `room.snapshot` (public lobby and player data), `game.started`, `game.snapshot`, `player.moved`, `player.died`, `body.spawned`, `task.progress`, `meeting.started`, `vote.updated`, `meeting.ended`, `game.ended`, `pong`, `error`.
- `game.started`/private self-state MUST be sent only to the corresponding player with their role and tasks; **never group-broadcast role allocation**.
- `game.snapshot` contains public players (`id,nickname,x,y,alive`), publicly visible bodies, phase, timers and aggregate task progress; it never leaks other players' private roles.
- `meeting.ended` contains `ejected_player_id|null`, `was_impostor` only if reveal setting allows, and updated phase.
- `game.ended` contains winner `"crew"|"impostor"` and reason.
- `error` contains stable code and safe message. Use close codes for unauthorized/room missing.

Clients never generate authoritative kill, vote, task-completion or game-winner state; they render server events and reconcile snapshots. Ilyar must define concrete full event payloads in backend docs and keep them compatible with this envelope.

## Rules
Phase progression: `waiting → playing → meeting → playing` (repeat) `→ finished`. Default: 4–6 players = 1 impostor; 7–10 = 2 impostors. 3 tasks/crew. Host starts; server chooses roles using secure randomness; all gameplay checks run on server. No premature win when starting. Document tie, parity, leaving and reconnect behavior with tests.
