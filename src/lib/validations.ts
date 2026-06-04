import { z } from "zod";

// -- Auth --

export const handleSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters.")
  .max(30, "Username must be at most 30 characters.")
  .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores.");

export const signupSchema = z.object({
  email: z.string().trim().email("Invalid email address.").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().default(""),
  handle: handleSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address.").toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color.")
      .optional(),
    handle: handleSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.color !== undefined || data.handle !== undefined, {
    message: "No valid fields to update.",
  });

// -- Boards --

export const createBoardSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").optional(),
});

export const reorderBoardsSchema = z.object({
  ids: z.array(z.string().min(1)),
});

// -- Columns --

export const createColumnSchema = z.object({
  label: z.string().trim().min(1, "Label is required."),
  boardId: z.string().min(1, "Board ID is required."),
});

export const updateColumnSchema = z
  .object({
    label: z.string().trim().min(1, "Label must be non-empty.").optional(),
    isDone: z.boolean().optional(),
  })
  .refine((data) => data.label !== undefined || data.isDone !== undefined, {
    message: "No valid fields to update.",
  });

export const reorderColumnsSchema = z.object({
  columns: z.array(
    z.object({
      id: z.string().min(1),
      order: z.number().int().min(0),
    })
  ),
});

export const deleteColumnSchema = z
  .object({
    moveToColumnId: z.string().nullable().optional(),
  })
  .optional()
  .default({});

// -- Tasks --

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  column: z.string().min(1, "Column ID is required."),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  column: z.string().min(1).optional(),
  order: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  deadline: z.string().nullable().optional(),
  movedByNonAssignee: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});

// -- Comments --

export const createCommentSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  content: z.string().trim().min(1, "Comment content is required."),
  author: z.string().trim().default(""),
});

// -- Invites --

export const createInviteSchema = z.object({
  boardId: z.string().min(1, "Board ID is required."),
});

// -- Classes (educator features) --

export const createClassSchema = z.object({
  name: z.string().trim().min(1, "Class name is required.").max(80, "Class name is too long."),
  term: z.string().trim().max(40, "Term is too long.").optional(),
});

export const updateClassSchema = z
  .object({
    name: z.string().trim().min(1, "Name must be non-empty.").max(80).optional(),
    term: z.string().trim().max(40).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.term !== undefined || d.archived !== undefined, {
    message: "No valid fields to update.",
  });

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required.").max(60, "Group name is too long."),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    order: z.number().int().min(0).optional(),
  })
  .refine((d) => d.name !== undefined || d.order !== undefined, {
    message: "No valid fields to update.",
  });

// Assign / move / remove / promote a class member.
export const updateMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  // groupId: a string assigns to that group; null returns the student to the lobby.
  groupId: z.string().nullable().optional(),
  // role: optionally promote/demote (educator may set "ta" or "student").
  role: z.enum(["student", "ta"]).optional(),
  // remove: when true, the member is removed from the class entirely.
  remove: z.boolean().optional(),
});

export const savePresetSchema = z.object({
  columns: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Column label is required.").max(40),
        isDone: z.boolean().default(false),
      })
    )
    .min(1, "At least one column is required.")
    .max(12, "Too many columns."),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Task title is required.").max(200),
        description: z.string().max(5000).default(""),
        columnIndex: z.number().int().min(0),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
    )
    .max(200, "Too many seed tasks.")
    .default([]),
});

export const cloneClassSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80).optional(),
  term: z.string().trim().max(40).optional(),
  copyRoster: z.boolean().default(false),
});

// -- Tags --

export const createTagSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color."),
  boardId: z.string().min(1, "Board ID is required."),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color.").optional(),
});

// -- Helper --

// Parses a zod schema against data, returns { data } on success or { error } on failure.
export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data };
  }
  const message = (result.error as z.ZodError<unknown>).issues.map((e) => e.message).join(" ");
  return { error: message };
}
