# Team development rules

1. **Never commit feature work directly to `main`.**
2. Work in your assigned branch. Keep commits small and descriptive, e.g. `feat(lobby): add code invitation`.
3. First sync your branch with the newest `main` after an approved integration. Resolve conflicts locally, without force-pushing shared branches.
4. Before PR: `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. Open a PR from **your branch → main** with overview, screenshots, manual steps, tests and issue link. PRs should be reviewed by another teammate. No merge before checks pass.
6. Keep secrets out of Git. Never use proprietary Among Us art or audio.
7. Owned files: Ibro owns `src/app/page.tsx`, `src/app/room/**`, `src/lib/api.ts`, `src/lib/guest.ts`, lobby components. Bayel owns `src/app/game/**`, `src/features/game/**`, `src/components/game/**`. Shared types/interfaces require a documented coordinated PR.
