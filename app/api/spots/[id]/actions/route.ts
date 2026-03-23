import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSpotState, setSpotAction } from "@/lib/repository";

const schema = z.object({
  action: z.union([z.literal("wantToGo"), z.literal("visited"), z.literal("favorite")]),
  active: z.boolean()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ wantToGo: false, visited: false, favorite: false, requiresAuth: true });
  }
  const { id } = await params;
  const state = await getSpotState(user.id, id);
  return NextResponse.json(state);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const { id } = await params;
    const state = await setSpotAction(user.id, id, payload.action, payload.active);
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}