ALTER TABLE `libraryAttachments` DROP FOREIGN KEY `libraryAttachments_chapterId_bookChapters_id_fk`;
ALTER TABLE `libraryAttachments` DROP FOREIGN KEY `libraryAttachments_chapterId_bookChapters_id_fk`;--> statement-breakpoint
ALTER TABLE `libraryAttachments` ADD CONSTRAINT `libraryAttachments_chapterId_bookChapters_id_fk` FOREIGN KEY (`chapterId`) REFERENCES `bookChapters`(`id`) ON DELETE cascade ON UPDATE no action;
