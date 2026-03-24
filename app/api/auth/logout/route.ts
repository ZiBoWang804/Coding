import { NextResponse } from "next/server";
import { getSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("yxj_session", "", {
    ...getSessionCookieOptions(),
    maxAge: 0
  });
  return response;
}
