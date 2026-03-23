import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSessionToken, getSessionCookieOptions } from "@/lib/auth";
import { isDemoDataEnabled } from "@/lib/database-mode";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email("请输入正确的邮箱地址"),
  password: z.string().min(6, "密码至少需要 6 位"),
  nickname: z.string().min(2, "昵称至少需要 2 个字符").max(24, "昵称最多 24 个字符"),
  homeCity: z.string().optional().nullable()
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());

    if (isDemoDataEnabled()) {
      const user = {
        id: `demo-${payload.email}`,
        email: payload.email,
        nickname: payload.nickname,
        role: "USER" as const,
        preferences: [],
        homeCity: payload.homeCity || null
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

    const exists = await prisma.user.findUnique({ where: { email: payload.email } });
    if (exists) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        nickname: payload.nickname,
        homeCity: payload.homeCity || null,
        preferences: []
      }
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      preferences: user.preferences,
      homeCity: user.homeCity
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "注册失败" }, { status: 400 });
  }
}
