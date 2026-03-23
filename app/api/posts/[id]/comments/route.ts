import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { addComment } from "@/lib/repository";

const schema = z.object({
  content: z.string().min(2).max(300)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录后评论" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const { id } = await params;
    const item = await addComment(user.id, id, payload.content);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "评论失败" }, { status: 400 });
  }
}