import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createCheckIn, listSpotCheckIns } from "@/lib/repository";

const schema = z.object({
  content: z.string().max(300).optional(),
  visitDate: z.string().optional(),
  imageUrls: z.array(z.string()).optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await listSpotCheckIns(id);
  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录后打卡" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const { id } = await params;
    const item = await createCheckIn(user.id, id, payload);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "打卡失败" }, { status: 400 });
  }
}