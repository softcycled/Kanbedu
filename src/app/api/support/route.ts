import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { z } from "zod";

const bugReportSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  browserInfo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = bugReportSchema.parse(body);

    const report = await prisma.bugReport.create({
      data: {
        userId: auth.userId,
        title: validated.title,
        description: validated.description,
        browserInfo: validated.browserInfo || "Unknown",
        status: "open",
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Support submission error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
