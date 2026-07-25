-- CreateTable
CREATE TABLE "monthly_plans" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "month" VARCHAR(7) NOT NULL,
  "budget_total_override" DECIMAL(10, 2),
  "savings_goal_override" DECIMAL(10, 2),

  CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_plans_user_id_month_key" ON "monthly_plans"("user_id", "month");

-- AddForeignKey
ALTER TABLE "monthly_plans"
ADD CONSTRAINT "monthly_plans_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
