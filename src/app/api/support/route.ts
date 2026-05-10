import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const bugReportSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  browserInfo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = bugReportSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Please provide a valid title (min 3 chars) and description (min 10 chars)." }, { status: 400 });
    }

    const validated = result.data;

    const report = await prisma.bugReport.create({
      data: {
        userId: session.userId,
        title: validated.title,
        description: validated.description,
        browserInfo: validated.browserInfo || "Unknown",
        status: "open",
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    // Discord Webhook Notification
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: `🐛 New Bug Report: ${validated.title}`,
              description: validated.description,
              color: 0xE8613A, // Kanbedu Accent Color
              fields: [
                { name: "Reported By", value: `${report.user.name} (${report.user.email})`, inline: true },
                { name: "Status", value: "Open", inline: true },
                { name: "Browser Info", value: `\`\`\`${report.browserInfo}\`\`\`` }
              ],
              timestamp: new Date().toISOString(),
              footer: { text: "Kanbedu Support System" }
            }]
          }),
        });
      } catch (webhookError) {
        console.error("Discord webhook failed:", webhookError);
      }
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("CRITICAL: Support submission failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
