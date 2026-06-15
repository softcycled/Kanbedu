import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SALT_ROUNDS = 12;
const COOKIE_NAME = "kanbedu-session";
const SECRET_RAW = process.env.KANBEDU_JWT_SECRET;
if (!SECRET_RAW) {
  throw new Error("CRITICAL SECURITY FATAL: KANBEDU_JWT_SECRET environment variable is missing.");
}
const SECRET = new TextEncoder().encode(SECRET_RAW);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

// Private helper — one DB round-trip, returns verification status too
async function resolveSession(): Promise<{ userId: string; emailVerified: boolean } | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    if (typeof payload.userId !== "string") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { passwordChangedAt: true, emailVerified: true } as any,
    }) as { passwordChangedAt: Date | null; emailVerified: boolean } | null;
    if (!user) return null;
    if (
      user.passwordChangedAt &&
      typeof payload.iat === "number" &&
      payload.iat * 1000 < user.passwordChangedAt.getTime()
    ) return null;
    return { userId: payload.userId, emailVerified: user.emailVerified };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ userId: string } | null> {
  const s = await resolveSession();
  return s ? { userId: s.userId } : null;
}

export async function getVerifiedSession(): Promise<{ userId: string } | null> {
  const s = await resolveSession();
  if (!s || !s.emailVerified) return null;
  return { userId: s.userId };
}

export async function getSessionFull(): Promise<{ userId: string; emailVerified: boolean } | null> {
  return resolveSession();
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// Utility: check whether a user is a member of a given board.
// Returns true when a BoardMember record exists for the user/board.
export async function isMemberOfBoard(userId: string, boardId: string): Promise<boolean> {
  if (!userId || !boardId) return false;
  try {
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId, boardId } },
      select: { id: true },
    });
    return !!membership;
  } catch (err) {
    console.error("isMemberOfBoard check failed:", err);
    return false;
  }
}

// Returns the caller's role within a class ("educator" | "ta" | "student"),
// or null when they are not a member. Mirrors isMemberOfBoard.
export async function getClassRole(
  userId: string,
  classId: string
): Promise<"educator" | "ta" | "student" | null> {
  if (!userId || !classId) return null;
  try {
    const membership = await prisma.classMember.findUnique({
      where: { userId_classId: { userId, classId } },
      select: { role: true },
    });
    if (!membership) return null;
    return membership.role as "educator" | "ta" | "student";
  } catch (err) {
    console.error("getClassRole check failed:", err);
    return null;
  }
}

// True when the caller may manage the class (educator or TA).
export async function isEducatorOf(userId: string, classId: string): Promise<boolean> {
  const role = await getClassRole(userId, classId);
  return role === "educator" || role === "ta";
}

// True when the class is archived. Archived classes are read-only at the
// management level — group/roster/preset/detail edits are rejected until the
// educator unarchives. Student group boards stay usable.
export async function isClassArchived(classId: string): Promise<boolean> {
  if (!classId) return false;
  try {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { archived: true } });
    return !!cls?.archived;
  } catch (err) {
    console.error("isClassArchived check failed:", err);
    return false;
  }
}
