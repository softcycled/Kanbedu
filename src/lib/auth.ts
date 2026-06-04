import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SALT_ROUNDS = 10;
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

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    if (typeof payload.userId === "string") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
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
