# Frontend integration and acceptance tests

## Smoke test
1. Start backend and frontend with provided env files.
2. In browser A create guest "Ibro" and room (10).
3. In private browser B create guest "Bayel", join by displayed 6-character code.
4. Both lobby pages display two participants and correct host badge; refresh both.
5. Verify start disabled until at least four people, and guest cannot start even with four.
6. With four browsers, host starts, all move to game route only after server confirmation.
7. Move with WASD; inspect positions on all devices; complete a task; kill and report; cast votes; verify only server confirms these actions.
8. Verify crew-win and impostor-win cases, reconnect, race (two votes/tasks) and explicit guest expiration.

## Static checks
`npm run typecheck`; `npm run lint`; `npm run build`.

## UX matrix
360px mobile; 390px mobile; 768px tablet; 1440px desktop. Chrome + Safari. Keyboard and no mouse. Slow/offline network and WebSocket reconnect.

The initial scaffold supports only the first part of this test plan; finish and demonstrate each assigned milestone in its PR.
