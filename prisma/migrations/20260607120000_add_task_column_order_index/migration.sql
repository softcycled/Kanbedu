-- DropIndex
DROP INDEX "Task_column_idx";

-- CreateIndex
CREATE INDEX "Task_column_order_idx" ON "Task"("column", "order");
