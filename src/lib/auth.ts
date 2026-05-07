import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const COOKIE_NAME = "kanbedu-session";
// In production, set KANBEDU_JWT_SECRET in .env
const SECRET_RAW = process.env.KANBEDU_JWT_SECRET ?? "kanbedu-dev-secret-change-in-prod";
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

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookie = cookies().get(COOKIE_NAME);
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
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
