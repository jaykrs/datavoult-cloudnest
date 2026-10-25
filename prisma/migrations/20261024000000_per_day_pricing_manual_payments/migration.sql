-- Hand-written in Prisma's MySQL migration format (the Prisma engines cannot be
-- downloaded where this change was authored). CI verifies it matches
-- schema.prisma with `prisma migrate diff --from-migrations ... --exit-code`.

-- Plans: `price` changes meaning from "price per billing cycle" to "price per
-- DAY in INR". Convert existing rows so what customers pay for a month stays
-- (approximately — rounded to paise) the same, then drop the billing cycle.
-- Review the converted prices in Admin > Products after deploying.
UPDATE `plans` SET `price` = ROUND(`price` / CASE `billingCycle` WHEN 'MONTHLY' THEN 30 WHEN 'QUARTERLY' THEN 90 ELSE 365 END, 2);

-- AlterTable
ALTER TABLE `plans` DROP COLUMN `billingCycle`;

-- CreateTable
CREATE TABLE `payment_requests` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `days` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('CARD', 'PAYPAL', 'CRYPTO', 'BANK_TRANSFER', 'UPI', 'NETBANKING', 'WALLET') NOT NULL,
    `status` ENUM('AWAITING_PAYMENT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'AWAITING_PAYMENT',
    `transactionRef` VARCHAR(191) NULL,
    `payerDetails` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` VARCHAR(191) NULL,
    `resultSubscriptionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_requests_reference_key`(`reference`),
    INDEX `payment_requests_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `payment_requests_userId_status_idx`(`userId`, `status`),
    INDEX `payment_requests_transactionRef_idx`(`transactionRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
