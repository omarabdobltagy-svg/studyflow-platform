CREATE TABLE `studentActivityEvents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `eventType` varchar(80) NOT NULL,
  `entityType` varchar(60) NOT NULL,
  `entityId` varchar(100),
  `summary` varchar(500) NOT NULL,
  `metadataJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `studentActivityEvents_id` PRIMARY KEY(`id`),
  CONSTRAINT `studentActivityEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `student_activity_user_created_idx` ON `studentActivityEvents` (`userId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `student_activity_entity_idx` ON `studentActivityEvents` (`entityType`,`entityId`);
