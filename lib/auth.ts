import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/constants";
import { isDemoDataEnabled } from "@/lib/database-mode";
import { prisma } from "@/lib/prisma";
import type { UserSummary } from "@/types";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "youxiangji-dev-secret-change-me");

type SessionPayload = {
  userId: string;
  role: "USER" | "ADMIN";
  email: string;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  preferences?: string[];
  homeCity?: string | null;
};

function mapUser(user: {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  role: "USER" | "ADMIN";
  preferences: string[];
  homeCity: string | null;
}): UserSummary {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    preferences: user.preferences,
    homeCity: user.homeCity
  };
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload;
}

const getCachedSessionPayload = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
});

export async function getSessionPayload() {
  return getCachedSessionPayload();
}

const getCachedCurrentUser = cache(async () => {
  const session = await getCachedSessionPayload();
  if (!session) return null;

  if (isDemoDataEnabled()) {
    return {
      id: session.userId,
      email: session.email,
      nickname: session.nickname,
      avatarUrl: session.avatarUrl ?? null,
      bio: session.bio ?? null,
      role: session.role,
      preferences: session.preferences ?? [],
      homeCity: session.homeCity ?? null
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        role: true,
        preferences: true,
        homeCity: true
      }
    });

    return user ? mapUser(user) : null;
  } catch {
    return null;
  }
});

export async function getCurrentUser() {
  return getCachedCurrentUser();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?entry=admin&redirect=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export function getSessionCookieOptions() {
  const appUrl = process.env.APP_URL || "";
  const shouldUseSecureCookie = process.env.NODE_ENV === "production" && appUrl.startsWith("https://");

  return {
    httpOnly: true,
    secure: shouldUseSecureCookie,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}
