-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'resgate';

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "reserve_starting_balance" DECIMAL(10, 2) NOT NULL DEFAULT 0;
