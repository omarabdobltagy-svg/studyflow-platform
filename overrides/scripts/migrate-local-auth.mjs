import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to apply the local-auth migration.");

const OWNER_OPEN_ID = "studyflow-local-owner";
const MIGRATION_ID = "2026-11-local-multi-account-auth";
const connection = await mysql.createConnection(databaseUrl);

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

try {
  const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new Error("The users table does not exist; refusing to create or reset a database.");
  }

  const [columns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('username', 'passwordHash', 'sessionVersion')"
  );
  const present = new Set(columns.map(row => row.COLUMN_NAME));
  if (!present.has("username")) {
    await connection.query("ALTER TABLE `users` ADD COLUMN `username` VARCHAR(80) NULL");
    console.log("[local-auth] Added users.username");
  }
  if (!present.has("passwordHash")) {
    await connection.query("ALTER TABLE `users` ADD COLUMN `passwordHash` VARCHAR(255) NULL");
    console.log("[local-auth] Added users.passwordHash");
  }
  if (!present.has("sessionVersion")) {
    await connection.query("ALTER TABLE `users` ADD COLUMN `sessionVersion` INT NOT NULL DEFAULT 0");
    console.log("[local-auth] Added users.sessionVersion");
  }

  const [indexes] = await connection.query("SHOW INDEX FROM `users` WHERE Key_name = ?", ["users_username_unique"]);
  if (!Array.isArray(indexes) || indexes.length === 0) {
    await connection.query("CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`)");
    console.log("[local-auth] Added unique username index");
  }

  await connection.query(
    "CREATE TABLE IF NOT EXISTS studyflow_migrations (id VARCHAR(100) NOT NULL PRIMARY KEY, completedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  const [markers] = await connection.query(
    "SELECT id FROM `studyflow_migrations` WHERE id = ? LIMIT 1",
    [MIGRATION_ID]
  );
  if (Array.isArray(markers) && markers.length > 0) {
    console.log("[local-auth] Legacy account migration already completed.");
  } else {
    const legacyUsername = (process.env.APP_LOGIN_USERNAME || "").trim().toLowerCase();
    const legacyPassword = process.env.APP_LOGIN_PASSWORD || "";
    const [legacyRows] = await connection.query(
      "SELECT id, openId, name, username, passwordHash FROM `users` WHERE openId = ? LIMIT 1",
      [OWNER_OPEN_ID]
    );
    const owner = Array.isArray(legacyRows) ? legacyRows[0] : undefined;

    if (!legacyUsername || !legacyPassword) {
      if (owner?.username && owner?.passwordHash) {
        // The account is already migrated; do not require the old environment credentials.
      } else {
        const [existingRows] = await connection.query("SELECT id FROM `users` ORDER BY id ASC LIMIT 2");
        if (Array.isArray(existingRows) && existingRows.length > 0) {
          throw new Error("Legacy owner credentials are missing and existing user records cannot be assigned safely.");
        }
      }
    } else {
      if (!/^[a-z0-9._-]{3,32}$/.test(legacyUsername)) {
        throw new Error("APP_LOGIN_USERNAME is not valid for local account migration.");
      }

      const [collisions] = await connection.query(
        "SELECT id FROM `users` WHERE username = ? LIMIT 1",
        [legacyUsername]
      );
      const collision = Array.isArray(collisions) ? collisions[0] : undefined;
      if (collision && (!owner || Number(collision.id) !== Number(owner.id))) {
        throw new Error("Legacy username is already assigned to another account; refusing to overwrite it.");
      }

      if (owner) {
        if (owner.username && owner.username !== legacyUsername) {
          throw new Error("The legacy owner already has a different username; refusing to replace account credentials.");
        }
        await connection.query(
          "UPDATE `users` SET username = COALESCE(username, ?), passwordHash = COALESCE(passwordHash, ?), name = COALESCE(name, ?), loginMethod = 'local', role = 'admin', lastSignedIn = CURRENT_TIMESTAMP WHERE id = ?",
          [legacyUsername, hashPassword(legacyPassword), legacyUsername, owner.id]
        );
      } else {
        const [existingRows] = await connection.query("SELECT id FROM `users` ORDER BY id ASC LIMIT 2");
        if (Array.isArray(existingRows) && existingRows.length > 1) {
          throw new Error("Multiple user rows exist without a local owner marker; refusing to guess which account owns the saved study data.");
        }
        const passwordHash = hashPassword(legacyPassword);
        if (Array.isArray(existingRows) && existingRows.length === 1) {
          // Keep the old user id so all existing student records remain attached.
          await connection.query(
            "UPDATE `users` SET openId = ?, name = COALESCE(name, ?), username = ?, passwordHash = ?, loginMethod = 'local', role = 'admin', lastSignedIn = CURRENT_TIMESTAMP WHERE id = ?",
            [OWNER_OPEN_ID, legacyUsername, legacyUsername, passwordHash, existingRows[0].id]
          );
        } else {
          await connection.query(
            "INSERT INTO `users` (openId, name, username, passwordHash, loginMethod, role, lastSignedIn) VALUES (?, ?, ?, ?, 'local', 'admin', CURRENT_TIMESTAMP)",
            [OWNER_OPEN_ID, legacyUsername, legacyUsername, passwordHash]
          );
        }
      }
    }

    await connection.query(
      "INSERT INTO `studyflow_migrations` (id) VALUES (?)",
      [MIGRATION_ID]
    );
    console.log("[local-auth] Legacy owner migration marker recorded.");
  }

  console.log("[local-auth] Account schema is ready.");
} finally {
  await connection.end();
}
