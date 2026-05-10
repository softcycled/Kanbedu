import { prisma } from "./prisma";

export type ActivityType = "MOVE" | "UPDATE" | "COMMENT" | "TAG" | "ASSIGNEE" | "CREATE" | "COMPLETE" | "REOPEN";

export async function recordActivity(
  taskId: string,
  userId: string,
  type: ActivityType,
  content: string
) {
  try {
    return await prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        type,
        content,
      },
    });
  } catch (error) {
    console.error("Failed to record activity:", error);
    // We don't want to fail the main operation if logging fails,
    // but in a production app we might want more robust error handling.
    return null;
  }
}
