# Railway production deployment

The StudyFlow application is built from `Dockerfile`, which extracts the source archive and creates the production bundle at `dist/index.js`.

## Runtime settings

- Railway public domain target port: `8080`.
- Service environment: `PORT=8080`.
- Start command: `node dist/index.js`.
- Do not run `pnpm db:push` as a startup or automatic pre-deploy command.

## Database migrations

Database migrations are schema changes, not a server-startup task. Apply them separately and only after reviewing the generated SQL against the current production schema. The production MySQL database already has `studentProfiles.selectionJson`; a repeated `ALTER TABLE ... ADD selectionJson` fails with MySQL `ER_DUP_FIELDNAME`.

Keep the MySQL service and its persistent volume intact when deploying the application.


## Local StudyFlow accounts

StudyFlow uses separate username/password accounts and signed HttpOnly session cookies. Passwords are stored as salted scrypt hashes and are never returned to the browser.

- `APP_SESSION_SECRET` is required to sign 30-day sessions.
- `APP_LOGIN_USERNAME` and `APP_LOGIN_PASSWORD` are used only once by the preview migration script to preserve the former owner account; they are not shared credentials for newly registered users.
- The users table has nullable `username` and `passwordHash` columns plus a unique username index. The additive migration source lives at `overrides/scripts/migrate-local-auth.mjs` (the Docker overlay places it at `/app/scripts/migrate-local-auth.mjs`); it is idempotent and uses a persistent migration marker so deleting the former owner account cannot silently recreate it.

The migration preserves the existing owner row and its user ID. Account deletion verifies the current password, requires an explicit confirmation phrase, removes S3-backed attachments, and cascades the account's database records. The legacy Forge storage API does not expose object deletion in this application.


## AI provider

The in-app assistant uses an OpenAI-compatible API endpoint. The default provider base URL is `https://openrouter.ai/api/v1` and the default model routing is `openrouter/auto`.

Set these variables on the **StudyFlow app** service:

- `AI_API_BASE_URL`: defaults to `https://openrouter.ai/api/v1`.
- `AI_MODEL`: defaults to `openrouter/auto`.
- `AI_API_KEY`: required secret from the selected API provider. Set this directly in Railway's secret variables; never commit it or send it in chat.

Without `AI_API_KEY`, the rest of the platform works and the assistant displays a setup message instead of pretending the integration is active.

## Teacher progress model

StudyFlow keeps three separate values: public teacher content, the teacher's paid-course catalogue, and the student's own completed topic. Public listings do not prove the last paid lesson, and a teacher's latest item does not prove that the student watched it. Exact paid-course item sequence remains unknown when the official public catalogue does not expose it.
