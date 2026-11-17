# Verification status

Confirmed locally: production build, TypeScript, ESLint, 11 frontend unit tests, zero npm audit findings, and the real 20-client join/movement/role privacy/reconnect/chat/20-vote probe. Backend has 116 passing tests and successful Docker CI. The worker standby/SIGTERM check passes.

The 180-second active-bot smoke exercised tasks, vent travel, sabotage/repair, kills/report, meetings/votes, finish and reconnect with no unexpected errors. Its report is `soak-debug.json`; timings include concurrent browser QA and are not cloud performance results.

The full browser regression is NOT green: some long walking scenarios time out around furnished map geometry. The 30-minute active-bot acceptance has NOT completed successfully. Earlier interrupted or stalled runs are not accepted as a performance certification. Run these checks again before treating this release as production validated, and repeat them on the deployed infrastructure.

Cloud deployment and cloud performance verification remain the owner's next step. See deployment instructions in both repositories.
