/*
  Warnings:

  - You are about to drop the `monthly_config` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "monthly_config" DROP CONSTRAINT "monthly_config_user_id_fkey";

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "recurrence" SET DEFAULT 'never';

-- DropTable
DROP TABLE "monthly_config";

-- CreateTable
CREATE TABLE "daily_categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "monthly_amount" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "daily_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_day" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fixed_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_incomes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receive_day" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recurring_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_setups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,

    CONSTRAINT "monthly_setups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_setups_user_id_month_key" ON "monthly_setups"("user_id", "month");

-- AddForeignKey
ALTER TABLE "daily_categories" ADD CONSTRAINT "daily_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_setups" ADD CONSTRAINT "monthly_setups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
