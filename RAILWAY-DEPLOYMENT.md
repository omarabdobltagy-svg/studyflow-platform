# Railway production deployment

The StudyFlow application is built from `Dockerfile`, which extracts the source archive and creates the production bundle at `dist/index.js`.

## Runtime settings

- Railway public domain target port: `8080`.
- Service environment: `PORT=8080`.
- Start command: `node dist/index.js`.
- Do not run `pnpm db:push` as a startup or automatic pre-deploy command.

## Database migrations

The production MySQL database already has `studentProfiles.selectionJson`; never add that column again. Do not run `pnpm db:push` during startup or as a pre-deploy command.

For the additive schema used by the current StudyFlow application, configure the **StudyFlow app** Railway service with this pre-deploy command:

```sh
node scripts/migrate-local-auth.mjs
```

This script checks the existing schema before applying its additive, idempotent changes. It preserves existing user IDs and linked student records. If account ownership is ambiguous or the configured legacy username conflicts with another account, it stops rather than guessing. It does not run the full Drizzle migration history and must not be replaced with `db:push`.

Keep the MySQL service and its persistent volume intact. Preview and production app services must each run this hook against their own configured `DATABASE_URL`; never point Preview at the production database.


## Local StudyFlow sign-in

The app uses its own same-origin login form and a signed HttpOnly session cookie. It does not require the Manus OAuth portal.

Set these variables on the **StudyFlow app** service:

- `APP_LOGIN_USERNAME`: the local username.
- `APP_LOGIN_PASSWORD`: the local password; keep it server-side.
- `APP_SESSION_SECRET`: a long random secret used to sign 30-day sessions.

Do not place any of these values in a `VITE_` variable or in the repository. No database schema migration is required for local sign-in. The local account adopts the only existing user row when one exists, preserving its user ID and linked study data; if multiple existing user rows are found, the login flow refuses to guess which one owns the data.


## AI provider

The in-app assistant uses an OpenAI-compatible API endpoint. The default provider base URL is `https://openrouter.ai/api/v1` and the default model routing is `openrouter/auto`.

Set these variables on the **StudyFlow app** service:

- `AI_API_BASE_URL`: defaults to `https://openrouter.ai/api/v1`.
- `AI_MODEL`: defaults to `openrouter/auto`.
- `AI_API_KEY`: required secret from the selected API provider. Set this directly in Railway's secret variables; never commit it or send it in chat.

Without `AI_API_KEY`, the rest of the platform works and the assistant displays a setup message instead of pretending the integration is active.

## Teacher progress model

StudyFlow keeps three separate values: public teacher content, the teacher's paid-course catalogue, and the student's own completed topic. Public listings do not prove the last paid lesson, and a teacher's latest item does not prove that the student watched it. Exact paid-course item sequence remains unknown when the official public catalogue does not expose it.
