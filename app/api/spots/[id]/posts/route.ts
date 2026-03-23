import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createPost, listSpotPosts } from "@/lib/repository";

const schema = z.object({
  title: z.string().min(4).max(60),
  content: z.string().min(12).max(1500),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  type: z.union([z.literal("STORY"), z.literal("GUIDE")]).optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const items = await listSpotPosts(id, user?.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录后发帖" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const { id } = await params;
    const item = await createPost(user.id, id, payload);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "发帖失败" }, { status: 400 });
  }
}