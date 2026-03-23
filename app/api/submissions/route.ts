import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSpotSubmission, listUserSubmissions } from "@/lib/repository";

const schema = z.object({
  name: z.string().min(2),
  province: z.string().min(2),
  city: z.string().min(2),
  district: z.string().optional(),
  address: z.string().optional(),
  description: z.string().min(12),
  tags: z.array(z.string()).min(1),
  suggestedDuration: z.string().optional(),
  transportInfo: z.string().optional(),
  imageUrl: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  reason: z.string().optional()
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const items = await listUserSubmissions(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const item = await createSpotSubmission(user.id, payload);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "提交失败" }, { status: 400 });
  }
}