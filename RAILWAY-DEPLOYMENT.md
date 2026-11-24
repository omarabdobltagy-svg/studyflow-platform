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

The in-app assistant continues to use the primary OpenAI-compatible provider:

- \`AI_API_BASE_URL\`: defaults to \`https://openrouter.ai/api/v1\`.
- \`AI_MODEL\`: defaults to \`openrouter/auto\`.
- \`AI_API_KEY\`: secret key for the primary provider. General assistant calls continue to use this provider.

The smart planner has a separate NVIDIA Nemotron 3 Ultra fallback:

- \`NVIDIA_API_KEY\`: NVIDIA NIM secret key, read independently from \`AI_API_KEY\`.
- \`NVIDIA_API_BASE_URL\`: defaults to \`https://integrate.api.nvidia.com/v1\`.
- \`NVIDIA_MODEL\`: defaults to \`nvidia/nemotron-3-ultra-550b-a55b\`.

The planner tries the primary provider first. It switches to NVIDIA only when the primary key is missing or the primary provider reports billing/credit exhaustion (including an explicit insufficient-quota response). Ordinary 5xx failures and unrelated authentication/validation errors do not trigger a silent switch. NVIDIA requests use the standard \`/chat/completions\` endpoint with \`stream: false\` and \`reasoning_effort: medium\`. Because the hosted NVIDIA model does not advertise structured-output support, the planner requests JSON in its prompt and validates the response against its Zod schema before saving. Invalid or incomplete plans are not saved.

**Railway secret scope:** add \`NVIDIA_API_KEY\` directly to the \`StudyFlow Preview 360\` service's Variables page as a service-specific secret. Do not add it to Shared Variables, commit it to GitHub, or paste it in chat. This integration is for the preview planner and does not modify the \`StudyFlow app\` production service. The general assistant is not switched to NVIDIA.

The NVIDIA model's official supported-language list does not currently include Arabic. The API integration can be tested, but Arabic plan quality must be checked with real responses before treating this as a fully validated Arabic planner.

## Teacher progress model

StudyFlow keeps three separate values: public teacher content, the teacher's paid-course catalogue, and the student's own completed topic. Public listings do not prove the last paid lesson, and a teacher's latest item does not prove that the student watched it. Exact paid-course item sequence remains unknown when the official public catalogue does not expose it.
