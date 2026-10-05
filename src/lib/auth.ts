import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

export const COOKIE_NAME = "af_session";

export type Session = { userId: number; role: Role; fullName: string };

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(s: Session) {
  return new SignJWT({ role: s.role, fullName: s.fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.userId))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: Number(payload.sub),
      role: payload.role as Role,
      fullName: payload.fullName as string,
    };
  } catch {
    return null;
  }
}

/** Use at the top of every protected API route. */
export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (!roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session } as const;
}