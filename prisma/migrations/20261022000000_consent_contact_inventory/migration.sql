-- Hand-written in Prisma's MySQL migration format (the Prisma engines cannot be
-- downloaded where this change was authored). CI verifies it matches
-- schema.prisma with `prisma migrate diff --from-migrations ... --exit-code`.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `privacyAcceptedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `inventoryCount` INTEGER NULL;

-- CreateTable
CREATE TABLE `contact_messages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('NEW', 'READ', 'RESOLVED') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contact_messages_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
