CREATE TABLE `plannerReconciliationJobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `impact` enum('local','structural') NOT NULL DEFAULT 'structural',
  `eventType` varchar(80) NOT NULL,
  `status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
  `attempts` int NOT NULL DEFAULT 0,
  `revision` int NOT NULL DEFAULT 1,
  `nextRunAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lockedUntil` timestamp NULL DEFAULT NULL,
  `lastError` varchar(500) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `planner_reconcile_user_unique` (`userId`),
  KEY `planner_reconcile_due_idx` (`status`, `nextRunAt`, `lockedUntil`),
  CONSTRAINT `planner_reconcile_jobs_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
