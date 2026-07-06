import type { Prisma } from "@prisma/client";

// Active (non-archived) class caps per plan. Pro billing isn't purchasable
// yet (see src/lib/pro.ts), so every account currently sits on the free cap.
export const FREE_ACTIVE_CLASS_LIMIT = 3;
export const PRO_ACTIVE_CLASS_LIMIT = 10;

// Thrown from inside the create/clone transactions when the cap is hit, so the
// route can tell "over the limit" apart from a real DB failure in its catch block.
export class ClassLimitReachedError extends Error {
  constructor(public limit: number, public isPro: boolean) {
    super("Class limit reached");
  }
}

// Shape of a class preset (stored as JSON on ClassPreset).
export interface PresetColumn {
  label: string;
  isDone: boolean;
}
export interface PresetTask {
  title: string;
  description: string;
  columnIndex: number;
  priority: string;
}
export interface PresetData {
  columns: PresetColumn[];
  tasks: PresetTask[];
}

// The starting layout used when a class has no custom preset — mirrors the
// default board columns created in /api/boards.
export const DEFAULT_PRESET: PresetData = {
  columns: [
    { label: "To Do", isDone: false },
    { label: "In Progress", isDone: false },
    { label: "Done", isDone: true },
  ],
  tasks: [],
};

// Normalize an unknown JSON value (e.g. from ClassPreset.columns/tasks) into a
// safe PresetData, falling back to the default layout when missing/invalid.
export function coercePreset(columns: unknown, tasks: unknown): PresetData {
  const cols = Array.isArray(columns)
    ? (columns as any[])
        .filter((c) => c && typeof c.label === "string" && c.label.trim())
        .map((c) => ({ label: String(c.label), isDone: !!c.isDone }))
    : [];
  const safeColumns = cols.length > 0 ? cols : DEFAULT_PRESET.columns;

  const safeTasks = Array.isArray(tasks)
    ? (tasks as any[])
        .filter((t) => t && typeof t.title === "string" && t.title.trim())
        .map((t) => ({
          title: String(t.title),
          description: typeof t.description === "string" ? t.description : "",
          columnIndex: Number.isInteger(t.columnIndex) ? t.columnIndex : 0,
          priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
        }))
    : [];

  return { columns: safeColumns, tasks: safeTasks };
}

// Creates a Board seeded from a preset, materializing its columns and seed
// tasks, and adds the given educator as the board owner. Must run inside a
// transaction. Returns the created board id.
//
// Reused by group creation and by class cloning so seeding stays consistent.
export async function createGroupBoard(
  tx: Prisma.TransactionClient,
  opts: { name: string; educatorId: string; preset: PresetData }
): Promise<string> {
  const { name, educatorId, preset } = opts;

  const board = await tx.board.create({ data: { name } });

  // Add the educator as owner so they can read/manage every group board.
  await tx.boardMember.create({
    data: { userId: educatorId, boardId: board.id, role: "owner" },
  });

  // Create columns sequentially so we can map preset column index -> column id
  // (labels may repeat, so createMany + re-query is not safe here).
  const columnIds: string[] = [];
  for (let i = 0; i < preset.columns.length; i++) {
    const col = preset.columns[i];
    const created = await tx.column.create({
      data: { label: col.label, order: i, isDone: col.isDone, boardId: board.id },
    });
    columnIds.push(created.id);
  }

  // Seed tasks, mapping each task's columnIndex onto a real column id.
  if (preset.tasks.length > 0) {
    const fallbackColumnId = columnIds[0];
    await tx.task.createMany({
      data: preset.tasks.map((t, idx) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        column: columnIds[t.columnIndex] ?? fallbackColumnId,
        order: idx,
      })),
    });
  }

  return board.id;
}
