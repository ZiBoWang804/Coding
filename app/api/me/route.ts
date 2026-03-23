import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, getCurrentUser, getSessionCookieOptions } from "@/lib/auth";
import { isDemoDataEnabled } from "@/lib/database-mode";
import { updateUserProfile } from "@/lib/repository";

const schema = z.object({
  nickname: z.string().min(2).max(24),
  bio: z.string().max(160).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  preferences: z.array(z.string()).max(12),
  homeCity: z.string().optional().nullable()
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());

    if (isDemoDataEnabled()) {
      const next = {
        ...user,
        nickname: payload.nickname,
        bio: payload.bio || null,
        avatarUrl: payload.avatarUrl || null,
        preferences: payload.preferences,
        homeCity: payload.homeCity || null
      };
      const token = await createSessionToken({
        userId: next.id,
        email: next.email,
        nickname: next.nickname,
        role: next.role,
        avatarUrl: next.avatarUrl,
        bio: next.bio,
        preferences: next.preferences,
        homeCity: next.homeCity
      });
      const response = NextResponse.json({ user: next });
      response.cookies.set("yxj_session", token, getSessionCookieOptions());
      return response;
    }

    const next = await updateUserProfile(user.id, {
      nickname: payload.nickname,
      bio: payload.bio || null,
      avatarUrl: payload.avatarUrl || null,
      preferences: payload.preferences,
      homeCity: payload.homeCity || null
    });
    return NextResponse.json({ user: next });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}
