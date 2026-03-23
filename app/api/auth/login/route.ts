import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSessionToken, getSessionCookieOptions } from "@/lib/auth";
import { isDemoDataEnabled } from "@/lib/database-mode";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email("请输入正确的邮箱地址"),
  password: z.string().min(6, "密码至少需要 6 位")
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());

    if (isDemoDataEnabled()) {
      const user = {
        id: `demo-${payload.email}`,
        email: payload.email,
        nickname: payload.email.split("@")[0] || "演示用户",
        role: "USER" as const,
        preferences: [],
        homeCity: null
      };
      const token = await createSessionToken({
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        preferences: user.preferences,
        homeCity: user.homeCity
      });
      const response = NextResponse.json({ user });
      response.cookies.set("yxj_session", token, getSessionCookieOptions());
      return response;
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      preferences: user.preferences,
      homeCity: user.homeCity,
      avatarUrl: user.avatarUrl,
      bio: user.bio
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        preferences: user.preferences,
        homeCity: user.homeCity
      }
    });
    response.cookies.set("yxj_session", token, getSessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登录失败" }, { status: 400 });
  }
}
