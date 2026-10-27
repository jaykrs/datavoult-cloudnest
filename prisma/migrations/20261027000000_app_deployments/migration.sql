-- Hand-written in Prisma's MySQL migration format (the Prisma engines cannot be
-- downloaded where this change was authored). CI verifies it matches
-- schema.prisma with `prisma migrate diff --from-migrations ... --exit-code`.

-- CreateTable
CREATE TABLE `deployments` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `appName` VARCHAR(80) NOT NULL,
    `repoUrl` VARCHAR(500) NOT NULL,
    `branch` VARCHAR(100) NOT NULL,
    `port` INTEGER NOT NULL,
    `mode` ENUM('PM2', 'DOCKER') NOT NULL,
    `httpsMode` ENUM('NONE', 'SELF_SIGNED', 'LETSENCRYPT') NOT NULL,
    `domain` VARCHAR(253) NULL,
    `envEnc` LONGTEXT NULL,
    `status` ENUM('DEPLOYING', 'RUNNING', 'FAILED') NOT NULL DEFAULT 'DEPLOYING',
    `log` LONGTEXT NULL,
    `lastDeployedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `deployments_userId_idx`(`userId`),
    UNIQUE INDEX `deployments_subscriptionId_port_key`(`subscriptionId`, `port`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
