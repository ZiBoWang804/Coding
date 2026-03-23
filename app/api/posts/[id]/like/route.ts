import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { togglePostLike } from "@/lib/repository";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录后点赞" }, { status: 401 });

  try {
    const { id } = await params;
    const result = await togglePostLike(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "点赞失败" }, { status: 400 });
  }
}