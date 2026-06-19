import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function safeNextParam(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = new URL(req.url).origin;
  const next = safeNextParam(req.nextUrl.searchParams.get("next"));

  try {
    const record = await prisma.emailVerification.findUnique({ where: { token } });

    if (!record) {
      return NextResponse.redirect(`${base}/verify-email/done?error=invalid`);
    }

    if (record.expiresAt < new Date()) {
      await prisma.emailVerification.delete({ where: { id: record.id } });
      return NextResponse.redirect(`${base}/verify-email/done?error=expired`);
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      prisma.emailVerification.deleteMany({ where: { userId: record.userId } }),
    ]);

    if (next) {
      const sep = next.includes("?") ? "&" : "?";
      return NextResponse.redirect(`${base}${next}${sep}auto=1`);
    }
    return NextResponse.redirect(`${base}/verify-email/done`);
  } catch {
    return NextResponse.redirect(`${base}/verify-email/done?error=unknown`);
  }
}
