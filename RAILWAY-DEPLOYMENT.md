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
