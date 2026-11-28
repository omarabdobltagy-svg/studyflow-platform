import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to apply the local-auth migration.");

const OWNER_OPEN_ID = "studyflow-local-owner";
const MIGRATION_ID = "2026-11-local-multi-account-auth";
const STUDENT_ACTIVITY_MIGRATION_ID = "2026-11-student-activity-events";
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

  // The Preview pre-deploy hook runs this additive script, not the full Drizzle
  // migration runner. Ensure the event table used by current routes exists.
  const [activityTables] = await connection.query("SHOW TABLES LIKE 'studentActivityEvents'");
  if (!Array.isArray(activityTables) || activityTables.length === 0) {
    await connection.query(
      "CREATE TABLE `studentActivityEvents` (" +
      "`id` INT NOT NULL AUTO_INCREMENT, " +
      "`userId` INT NOT NULL, " +
      "`eventType` VARCHAR(80) NOT NULL, " +
      "`entityType` VARCHAR(60) NOT NULL, " +
      "`entityId` VARCHAR(100) NULL, " +
      "`summary` VARCHAR(500) NOT NULL, " +
      "`metadataJson` TEXT NOT NULL, " +
      "`createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
      "PRIMARY KEY (`id`), " +
      "KEY `student_activity_user_created_idx` (`userId`, `createdAt`), " +
      "KEY `student_activity_entity_idx` (`entityType`, `entityId`), " +
      "CONSTRAINT `studentActivityEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    console.log("[student-activity] Created studentActivityEvents.");
  }

  const [activityColumns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'studentActivityEvents'"
  );
  const activityColumnNames = new Set(activityColumns.map(row => row.COLUMN_NAME));
  const requiredActivityColumns = ["id", "userId", "eventType", "entityType", "entityId", "summary", "metadataJson", "createdAt"];
  const missingActivityColumns = requiredActivityColumns.filter(column => !activityColumnNames.has(column));
  if (missingActivityColumns.length) {
    throw new Error("studentActivityEvents is missing required columns: " + missingActivityColumns.join(", ") + ". Refusing to start with an incompatible activity schema.");
  }

  const [activityIndexes] = await connection.query("SHOW INDEX FROM `studentActivityEvents`");
  const activityIndexNames = new Set(activityIndexes.map(row => row.Key_name));
  if (!activityIndexNames.has("student_activity_user_created_idx")) {
    await connection.query("CREATE INDEX `student_activity_user_created_idx` ON `studentActivityEvents` (`userId`, `createdAt`)");
  }
  if (!activityIndexNames.has("student_activity_entity_idx")) {
    await connection.query("CREATE INDEX `student_activity_entity_idx` ON `studentActivityEvents` (`entityType`, `entityId`)");
  }

  const [activityForeignKeys] = await connection.query(
    "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'studentActivityEvents' AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME = 'users' AND REFERENCED_COLUMN_NAME = 'id'"
  );
  if (!Array.isArray(activityForeignKeys) || activityForeignKeys.length === 0) {
    await connection.query(
      "ALTER TABLE `studentActivityEvents` ADD CONSTRAINT `studentActivityEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    );
  }

  await connection.query("INSERT IGNORE INTO `studyflow_migrations` (id) VALUES (?)", [STUDENT_ACTIVITY_MIGRATION_ID]);
  console.log("[student-activity] Activity event schema is ready.");

  // The deployed Preview/Production hook does not run the full Drizzle migrator.
  // Apply these additive, idempotent migrations explicitly before server startup.
  const [plannerTables] = await connection.query("SHOW TABLES LIKE 'plannerReconciliationJobs'");
  if (!Array.isArray(plannerTables) || plannerTables.length === 0) {
    await connection.query(
      "CREATE TABLE `plannerReconciliationJobs` (" +
      "`id` int NOT NULL AUTO_INCREMENT, `userId` int NOT NULL, " +
      "`impact` enum('local','structural') NOT NULL DEFAULT 'structural', " +
      "`eventType` varchar(80) NOT NULL, `status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued', " +
      "`attempts` int NOT NULL DEFAULT 0, `revision` int NOT NULL DEFAULT 1, " +
      "`nextRunAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `lockedUntil` timestamp NULL DEFAULT NULL, " +
      "`lastError` varchar(500) DEFAULT NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
      "`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
      "PRIMARY KEY (`id`), UNIQUE KEY `planner_reconcile_user_unique` (`userId`), " +
      "KEY `planner_reconcile_due_idx` (`status`, `nextRunAt`, `lockedUntil`), " +
      "CONSTRAINT `planner_reconcile_jobs_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    console.log("[planner-reconciliation] Created plannerReconciliationJobs.");
  }
  const [plannerColumns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plannerReconciliationJobs'"
  );
  const plannerColumnNames = new Set(plannerColumns.map(row => row.COLUMN_NAME));
  const requiredPlannerColumns = ["id", "userId", "impact", "eventType", "status", "attempts", "revision", "nextRunAt", "lockedUntil", "lastError", "createdAt", "updatedAt"];
  const missingPlannerColumns = requiredPlannerColumns.filter(column => !plannerColumnNames.has(column));
  if (missingPlannerColumns.length) throw new Error("plannerReconciliationJobs is missing required columns: " + missingPlannerColumns.join(", ") + ".");

  const [taskEstimateColumns] = await connection.query(
    "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'estimatedMinutes'"
  );
  if (Array.isArray(taskEstimateColumns) && taskEstimateColumns[0]?.IS_NULLABLE === "NO") {
    await connection.query("ALTER TABLE `tasks` MODIFY COLUMN `estimatedMinutes` int NULL DEFAULT NULL");
    console.log("[task-estimates] Made tasks.estimatedMinutes nullable.");
  }

  await connection.query(
    "CREATE TABLE IF NOT EXISTS `teacherCourseFacts` (" +
    "`id` int NOT NULL AUTO_INCREMENT, `teacherId` varchar(80) NOT NULL, `teacherName` varchar(120) NOT NULL, " +
    "`subjectId` varchar(80) NOT NULL, `educationSystem` varchar(40) NOT NULL, `gradeYear` varchar(60) NOT NULL, " +
    "`availableModesJson` text NOT NULL, `homeworkPolicy` varchar(20) NOT NULL DEFAULT 'unknown', " +
    "`homeworkRequiredBeforeNextLecture` varchar(20) NOT NULL DEFAULT 'unknown', " +
    "`preLectureExamRequired` varchar(20) NOT NULL DEFAULT 'unknown', `evidenceJson` text NOT NULL, " +
    "`confidence` varchar(20) NOT NULL DEFAULT 'low', `verificationStatus` varchar(30) NOT NULL DEFAULT 'insufficient_evidence', " +
    "`checkedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `expiresAt` timestamp NOT NULL, " +
    "`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
    "PRIMARY KEY (`id`), UNIQUE KEY `teacher_course_facts_scope_unique` (`teacherId`, `subjectId`, `educationSystem`, `gradeYear`), " +
    "KEY `teacher_course_facts_expiry_idx` (`expiresAt`, `verificationStatus`)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  const [teacherFactColumns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teacherCourseFacts'"
  );
  const teacherFactColumnNames = new Set(teacherFactColumns.map(row => row.COLUMN_NAME));
  const requiredTeacherFactColumns = ["id", "teacherId", "teacherName", "subjectId", "educationSystem", "gradeYear", "availableModesJson", "homeworkPolicy", "homeworkRequiredBeforeNextLecture", "preLectureExamRequired", "evidenceJson", "confidence", "verificationStatus", "checkedAt", "expiresAt", "createdAt", "updatedAt"];
  const missingTeacherFactColumns = requiredTeacherFactColumns.filter(column => !teacherFactColumnNames.has(column));
  if (missingTeacherFactColumns.length) throw new Error("teacherCourseFacts is missing required columns: " + missingTeacherFactColumns.join(", ") + ".");
  // Shared teacher directory is global to the Preview workspace, scoped by
  // subject, education system and grade year. The unique key prevents duplicate
  // records when multiple students submit the same teacher.
  await connection.query(
    "CREATE TABLE IF NOT EXISTS `teacherDirectoryEntries` (" +
    "`id` int NOT NULL AUTO_INCREMENT, `normalizedName` varchar(180) NOT NULL, " +
    "`teacherName` varchar(120) NOT NULL, `brandName` varchar(180) NOT NULL, " +
    "`subjectId` varchar(80) NOT NULL, `educationSystem` varchar(40) NOT NULL, `gradeYear` varchar(60) NOT NULL, " +
    "`sourceUrl` text NOT NULL, `availableModesJson` text NOT NULL, `confidence` varchar(20) NOT NULL DEFAULT 'low', " +
    "`evidenceJson` text NOT NULL, `notes` text NULL, `confirmationCount` int NOT NULL DEFAULT 1, `submittedBy` int DEFAULT NULL, " +
    "`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
    "PRIMARY KEY (`id`), UNIQUE KEY `teacher_directory_scope_unique` (`normalizedName`, `subjectId`, `educationSystem`, `gradeYear`), " +
    "KEY `teacher_directory_subject_idx` (`subjectId`, `educationSystem`, `gradeYear`, `updatedAt`), " +
    "CONSTRAINT `teacher_directory_submitted_by_fk` FOREIGN KEY (`submittedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  const [teacherDirectoryColumns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teacherDirectoryEntries'"
  );
  const teacherDirectoryColumnNames = new Set(teacherDirectoryColumns.map(row => row.COLUMN_NAME));
  const requiredTeacherDirectoryColumns = [
    "id", "normalizedName", "teacherName", "brandName", "subjectId", "educationSystem", "gradeYear",
    "sourceUrl", "availableModesJson", "confidence", "evidenceJson", "notes", "confirmationCount",
    "submittedBy", "createdAt", "updatedAt",
  ];
  const missingTeacherDirectoryColumns = requiredTeacherDirectoryColumns.filter(column => !teacherDirectoryColumnNames.has(column));
  if (missingTeacherDirectoryColumns.length) {
    throw new Error("teacherDirectoryEntries is missing required columns: " + missingTeacherDirectoryColumns.join(", ") + ".");
  }

  // Persistent, account-scoped assistant conversations. IF NOT EXISTS keeps this
  // additive migration safe when the deployment is restarted or retried.
  await connection.query(
    "CREATE TABLE IF NOT EXISTS `assistantConversations` (" +
    "`id` int NOT NULL AUTO_INCREMENT, `userId` int NOT NULL, `clientId` varchar(80) NOT NULL, `title` varchar(80) NOT NULL, " +
    "`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
    "PRIMARY KEY (`id`), UNIQUE KEY `assistant_conversation_user_client_unique` (`userId`, `clientId`), " +
    "KEY `assistant_conversations_user_updated_idx` (`userId`, `updatedAt`), " +
    "CONSTRAINT `assistant_conversations_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  await connection.query(
    "CREATE TABLE IF NOT EXISTS `assistantMessages` (" +
    "`id` int NOT NULL AUTO_INCREMENT, `conversationId` int NOT NULL, `role` enum('user','assistant') NOT NULL, " +
    "`content` text NOT NULL, `sortOrder` int NOT NULL DEFAULT 0, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
    "PRIMARY KEY (`id`), KEY `assistant_messages_conversation_order_idx` (`conversationId`, `sortOrder`), " +
    "CONSTRAINT `assistant_messages_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `assistantConversations` (`id`) ON DELETE CASCADE" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  const [assistantConversationColumns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assistantConversations'"
  );
  const requiredAssistantConversationColumns = ["id", "userId", "clientId", "title", "createdAt", "updatedAt"];
  const assistantConversationColumnNames = new Set(assistantConversationColumns.map(row => row.COLUMN_NAME));
  const missingAssistantConversationColumns = requiredAssistantConversationColumns.filter(column => !assistantConversationColumnNames.has(column));
  if (missingAssistantConversationColumns.length) {
    throw new Error("assistantConversations is missing required columns: " + missingAssistantConversationColumns.join(", ") + ".");
  }
  const [assistantMessageColumns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assistantMessages'"
  );
  const requiredAssistantMessageColumns = ["id", "conversationId", "role", "content", "sortOrder", "createdAt"];
  const assistantMessageColumnNames = new Set(assistantMessageColumns.map(row => row.COLUMN_NAME));
  const missingAssistantMessageColumns = requiredAssistantMessageColumns.filter(column => !assistantMessageColumnNames.has(column));
  if (missingAssistantMessageColumns.length) {
    throw new Error("assistantMessages is missing required columns: " + missingAssistantMessageColumns.join(", ") + ".");
  }

  await connection.query("INSERT IGNORE INTO `studyflow_migrations` (id) VALUES (?)", ["2026-11-teacher-directory"]);
  await connection.query("INSERT IGNORE INTO `studyflow_migrations` (id) VALUES (?)", ["2026-11-planner-reconciliation"]);
  await connection.query("INSERT IGNORE INTO `studyflow_migrations` (id) VALUES (?)", ["2026-11-task-estimates-nullable"]);
  await connection.query("INSERT IGNORE INTO `studyflow_migrations` (id) VALUES (?)", ["2026-11-teacher-course-facts"]);
  await connection.query("INSERT IGNORE INTO `studyflow_migrations` (id) VALUES (?)", ["2026-11-assistant-conversations"]);


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
