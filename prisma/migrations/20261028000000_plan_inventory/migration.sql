-- Hand-written in Prisma's MySQL migration format (the Prisma engines cannot be
-- downloaded where this change was authored). CI verifies it matches
-- schema.prisma with `prisma migrate diff --from-migrations ... --exit-code`.

-- AlterTable
ALTER TABLE `plans` ADD COLUMN `inventoryCount` INTEGER NULL;
