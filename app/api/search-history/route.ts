import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSearchHistory, listSearchHistory } from "@/lib/repository";

const schema = z.object({
  query: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  tag: z.string().optional(),
  preferences: z.array(z.string()).optional(),
  resultIds: z.array(z.string()).optional()
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] });
  const items = await listSearchHistory(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true, skipped: true });

  try {
    const payload = schema.parse(await request.json());
    const item = await createSearchHistory(user.id, payload);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "记录失败" }, { status: 400 });
  }
}