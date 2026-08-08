-- Improve the hottest transaction lookups used by dashboard, analytics and recurring-series flows.
CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date");
CREATE INDEX "transactions_user_id_type_date_idx" ON "transactions"("user_id", "type", "date");
CREATE INDEX "transactions_user_id_category_id_date_idx" ON "transactions"("user_id", "category_id", "date");
CREATE INDEX "transactions_user_id_series_id_date_idx" ON "transactions"("user_id", "series_id", "date");
