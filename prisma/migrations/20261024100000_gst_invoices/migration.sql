-- Hand-written in Prisma's MySQL migration format (the Prisma engines cannot be
-- downloaded where this change was authored). CI verifies it matches
-- schema.prisma with `prisma migrate diff --from-migrations ... --exit-code`.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `gstRate` DECIMAL(5, 2) NULL,
    ADD COLUMN `gstInclusive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sacCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `billingName` VARCHAR(191) NULL,
    ADD COLUMN `billingGstin` VARCHAR(191) NULL,
    ADD COLUMN `billingAddress` TEXT NULL,
    ADD COLUMN `billingStateCode` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `fy` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` VARCHAR(191) NOT NULL,
    `sacCode` VARCHAR(191) NULL,
    `days` INTEGER NULL,
    `taxableAmount` DECIMAL(10, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL,
    `cgst` DECIMAL(10, 2) NOT NULL,
    `sgst` DECIMAL(10, 2) NOT NULL,
    `igst` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `placeOfSupply` VARCHAR(191) NULL,
    `seller` JSON NOT NULL,
    `buyer` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoices_number_key`(`number`),
    UNIQUE INDEX `invoices_paymentId_key`(`paymentId`),
    INDEX `invoices_userId_issuedAt_idx`(`userId`, `issuedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_counters` (
    `id` VARCHAR(191) NOT NULL,
    `lastNumber` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
