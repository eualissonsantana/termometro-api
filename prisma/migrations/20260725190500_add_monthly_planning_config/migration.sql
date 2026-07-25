-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "monthly_budget_total" DECIMAL(10, 2),
  ADD COLUMN "monthly_savings_goal" DECIMAL(10, 2);
