# Railway deployment and verified runtime behavior

The StudyFlow application is built from `Dockerfile`, which extracts the source archive and overlays the maintained files under `overrides/` before creating `dist/index.js`.

## Runtime settings

- Railway public domain target port: `8080`.
- Service environment: `PORT=8080`.
- Start command: `node dist/index.js`.
- The current Preview service is attached to `redesign/studyflow-v4-graphite`; this does not authorize changes to the separate `StudyFlow app` production service.
- Do not run `pnpm db:push` as a startup or automatic pre-deploy command.

## Database migrations

The Preview service pre-deploy command runs `node scripts/migrate-local-auth.mjs`.

That additive, idempotent script:
- Adds the local account columns and unique username index if missing.
- Creates or validates `studentActivityEvents`, including its columns, indexes and user foreign key. This table is used by the activity feed and event logging.
- Stores migration markers in `studyflow_migrations` and refuses to guess account ownership when legacy account data is ambiguous.

The event table existed in the Drizzle journal, but the Preview pre-deploy command did not run the Drizzle migration runner. The additive check closes that gap without running every historical migration or using `db:push`. Future schema migrations still require review.

## Local StudyFlow accounts

StudyFlow uses separate username/password accounts and signed HttpOnly session cookies. Passwords are stored as salted scrypt hashes and are never returned to the browser.

- `APP_SESSION_SECRET` is required to sign 30-day sessions.
- `APP_LOGIN_USERNAME` and `APP_LOGIN_PASSWORD` are used only once by the Preview migration script to preserve the former owner account.
- Login failure limits and registration-attempt limits are separate, bounded in-memory windows. This is suitable only for the current single-replica Preview service; process restarts reset them, and multiple replicas would require a shared limiter.
- Phone numbers are stored without SMS verification; there is no self-service password-reset flow.

Account deletion verifies the current password, requires an explicit confirmation phrase, removes S3-backed attachments and cascades account database records. The legacy Forge storage API used here does not expose object deletion.

## AI provider and fallback

The primary OpenAI-compatible provider is configured with:
- `AI_API_BASE_URL` (defaults to `https://openrouter.ai/api/v1`).
- `AI_MODEL` (defaults to `openrouter/auto`).
- `AI_API_KEY`.

The independent NVIDIA Nemotron 3 Ultra provider is configured with:
- `NVIDIA_API_KEY`, read independently from `AI_API_KEY`.
- `NVIDIA_API_BASE_URL` (defaults to `https://integrate.api.nvidia.com/v1`).
- `NVIDIA_MODEL` (defaults to `nvidia/nemotron-3-ultra-550b-a55b`).

The smart planner and free-form study assistant use the primary provider first. They switch to NVIDIA for a missing primary key, billing/credit exhaustion, or an empty/truncated completion. The planner also switches when primary output is malformed JSON or fails Zod validation. Unrelated 5xx failures and unrelated authentication/validation errors do not trigger a silent switch.

NVIDIA planner requests use JSON-object mode, `max_tokens=6144`, `reasoning_effort: "none"`, `chat_template_kwargs: { force_nonempty_content: true }`, and `stream: false`. HTTP 202 responses are polled by request ID. Plans are validated against the Zod schema before they are saved.

**Live Preview test, 2026-11-24:** a signed-in `plans.generate` request returned HTTP 200 after DeepSeek returned `finish_reason: "length"` with empty content. The logs show NVIDIA fallback, successful plan generation, and approval into five tasks plus a routine. A separate live chat smoke test is still required after the assistant fallback change.

Official NVIDIA materials are inconsistent about Arabic: the hosted model card's language list omits it, while NVIDIA NGC container listings include Arabic. Do not infer Arabic response quality from metadata alone; judge it against actual curriculum questions, terminology and Egyptian Arabic.

## Storage and book uploads

Attachment upload requires either all five Railway S3 variables (`STUDYFLOW_STORAGE_ENDPOINT`, `STUDYFLOW_STORAGE_BUCKET`, `STUDYFLOW_STORAGE_REGION`, `STUDYFLOW_STORAGE_ACCESS_KEY_ID`, `STUDYFLOW_STORAGE_SECRET_ACCESS_KEY`) or the supported Forge URL/key pair (`BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`).

The current Preview service has neither configuration. Book-file upload is therefore unavailable until a storage provider is connected. The API returns an explicit Arabic configuration error instead of a generic English message.

Uploaded attachments are stored for download; their contents are not parsed and added to assistant retrieval. The assistant currently retrieves only the curated static textbook corpus.

## Curriculum coverage

- Searchable sources include Arabic Part 1, History Part 1, and Programming & AI Part 2 (Chapters 5–7).
- English Part 1 is currently table-of-contents only; its lesson pages are not indexed.
- Programming & AI Part 1 (Chapters 1–4) has a page map but no indexed page text or images.
- Arabic Part 2 and History Part 2 fragments do have page markers and are searchable, but extraction quality is degraded by Unicode replacement characters (U+FFFD). Exact wording and quotations must be checked against the original PDF pages.

The retrieval pipeline now reports unindexed files and extraction-quality warnings to the assistant instead of implying full coverage. It does not invent missing page boundaries.

## Teacher, parent and external learning integrations

Teacher/course metadata and public links form a reference catalog, not a live connector. Student and school progress are currently manually reported; no automated Englishawy/Class progress sync is implemented. For external platform integrations, use an official partner API, authorized export, or provider-approved connection flow. Do not collect students' platform passwords or scrape private student sessions.

There is no separate parent portal/router or parent notification workflow in the current app. Phone verification and password reset also need an email/SMS provider and product decisions.

## Teacher progress model

StudyFlow stores three separate values: public teacher content, the teacher's paid-course catalogue, and the student's own completed topic. Public listings do not prove the last paid lesson, and a teacher's latest item does not prove the student watched it. Exact paid-course item sequence remains unknown when the official public catalogue does not expose it.
