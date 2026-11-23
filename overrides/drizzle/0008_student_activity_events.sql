CREATE TABLE IF NOT EXISTS `studentActivityEvents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `eventType` VARCHAR(80) NOT NULL,
  `entityType` VARCHAR(60) NOT NULL,
  `entityId` VARCHAR(100) NULL,
  `summary` VARCHAR(500) NOT NULL,
  `metadataJson` TEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_activity_user_created_idx` (`userId`, `createdAt`),
  KEY `student_activity_entity_idx` (`entityType`, `entityId`),
  CONSTRAINT `student_activity_user_fk`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
