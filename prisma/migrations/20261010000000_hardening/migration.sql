-- NOTE: written by hand in Prisma's MySQL migration format because the Prisma
-- engines could not be downloaded where this change was authored. Verify with:
--   npx prisma migrate diff --from-migrations prisma/migrations \
--     --to-schema-datamodel prisma/schema.prisma --shadow-database-url <url> --exit-code
-- (an empty diff means this file matches schema.prisma).

-- AlterTable
ALTER TABLE `subscriptions` MODIFY `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TRIAL') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `service_configs` ADD COLUMN `hostKeySha256` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `plans` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `payments` MODIFY `method` ENUM('CARD', 'PAYPAL', 'CRYPTO', 'BANK_TRANSFER', 'UPI', 'NETBANKING', 'WALLET') NOT NULL DEFAULT 'CARD';

-- CreateTable
CREATE TABLE `provisioning_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'DONE', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provisioning_jobs_subscriptionId_key`(`subscriptionId`),
    INDEX `provisioning_jobs_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `payments_gatewayId_key` ON `payments`(`gatewayId`);

-- CreateIndex
CREATE INDEX `subscriptions_status_renewsAt_idx` ON `subscriptions`(`status`, `renewsAt`);

-- AddForeignKey
ALTER TABLE `provisioning_jobs` ADD CONSTRAINT `provisioning_jobs_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
