
## Current CREWMATE X release: Vercel + Northflank

Deploy frontend branch `main` using the Next.js preset, `npm ci`, and `npm run build` on Vercel. Configure `NEXT_PUBLIC_API_URL=https://<backend-host>` and `NEXT_PUBLIC_WS_URL=wss://<backend-host>` **before building**. Rebuild after changing either value. No trailing `/api/v1` path is needed.

Deploy backend `main` separately using its [quickstart](https://github.com/ibrodevs/among-us-backend/blob/main/docs/deployment/QUICKSTART.md). It requires PostgreSQL, Redis, one API service and a continuously running worker. Run the serialized migration job first. Set the backend CORS origin to the exact HTTPS frontend origin. Check API `/api/v1/ready/` before testing a match.

Do not enable `MAP_REVIEW_ENABLED` on a public build. Local benchmark results are not a cloud capacity guarantee; repeat the 20-player probe after deployment.
