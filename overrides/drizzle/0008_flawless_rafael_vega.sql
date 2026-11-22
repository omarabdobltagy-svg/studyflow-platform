CREATE TABLE `studentAuthCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(32) NOT NULL,
	`normalizedUsername` varchar(32) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentAuthCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_auth_user_id_idx` UNIQUE(`userId`),
	CONSTRAINT `student_auth_username_idx` UNIQUE(`normalizedUsername`)
);
--> statement-breakpoint
SET @studyflow_has_selection_json = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'studentProfiles'
    AND COLUMN_NAME = 'selectionJson'
);
--> statement-breakpoint
SET @studyflow_selection_json_ddl = IF(
  @studyflow_has_selection_json = 0,
  'ALTER TABLE `studentProfiles` ADD `selectionJson` text',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE studyflow_selection_json_stmt FROM @studyflow_selection_json_ddl;
--> statement-breakpoint
EXECUTE studyflow_selection_json_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE studyflow_selection_json_stmt;
--> statement-breakpoint
SET @studyflow_has_users_phone = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'phone'
);
--> statement-breakpoint
SET @studyflow_users_phone_ddl = IF(
  @studyflow_has_users_phone = 0,
  'ALTER TABLE `users` ADD `phone` varchar(20)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE studyflow_users_phone_stmt FROM @studyflow_users_phone_ddl;
--> statement-breakpoint
EXECUTE studyflow_users_phone_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE studyflow_users_phone_stmt;
--> statement-breakpoint
ALTER TABLE `studentAuthCredentials` ADD CONSTRAINT `studentAuthCredentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;