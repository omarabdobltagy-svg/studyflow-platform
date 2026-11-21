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


## Local StudyFlow sign-in

The app uses its own same-origin login form and a signed HttpOnly session cookie. It does not require the Manus OAuth portal.

Set these variables on the **StudyFlow app** service:

- `APP_LOGIN_USERNAME`: the local username.
- `APP_LOGIN_PASSWORD`: the local password; keep it server-side.
- `APP_SESSION_SECRET`: a long random secret used to sign 30-day sessions.

Do not place any of these values in a `VITE_` variable or in the repository. No database schema migration is required for local sign-in. The local account adopts the only existing user row when one exists, preserving its user ID and linked study data; if multiple existing user rows are found, the login flow refuses to guess which one owns the data.
