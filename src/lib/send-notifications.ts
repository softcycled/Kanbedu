import webpush from "web-push";
import { prisma } from "@/lib/prisma";

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@kanbedu.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface NotificationPayload {
  type: "ASSIGNED" | "COMMENT" | "MOVED" | "COMPLETED" | "REOPENED";
  title: string;
  body: string;
  taskId?: string;
  boardId?: string;
  tag?: string;
}

export async function sendNotification(userId: string, payload: NotificationPayload): Promise<void> {
  const [, subs] = await Promise.all([
    prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        taskId: payload.taskId ?? null,
        boardId: payload.boardId ?? null,
      },
    }),
    prisma.pushSubscription.findMany({ where: { userId } }),
  ]);

  if (!process.env.VAPID_PRIVATE_KEY || subs.length === 0) return;

  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, tag: payload.tag })
        )
        .catch(async (err: { statusCode?: number }) => {
          // 404/410 = subscription gone; 400/403 = permanently invalid (bad/expired VAPID claim, key mismatch).
          // All are terminal — retrying will never succeed, so remove to stop wasted delivery attempts.
          if (err.statusCode && [400, 403, 404, 410].includes(err.statusCode)) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        })
    )
  );
}
