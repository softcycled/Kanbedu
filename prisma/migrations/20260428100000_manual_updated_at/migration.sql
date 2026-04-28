-- Switch updatedAt from auto-managed to manual so order-only patches don't bump it.
-- No schema change needed in SQLite (column type stays the same); only Prisma directive changed.
SELECT 1;
