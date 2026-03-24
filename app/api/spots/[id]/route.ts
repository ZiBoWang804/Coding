import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { normalizeSpotInput } from "@/lib/importer";
import { deleteSpot, getSpotById, updateSpot } from "@/lib/repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getSpotById(id);
  if (!item) {
    return NextResponse.json({ error: "未找到该景点" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const payload = await request.json();
    const data = normalizeSpotInput({
      ...payload,
      source: payload.source || "admin_import",
      bestSeason: payload.bestSeason || ["春", "秋"]
    });
    const item = await updateSpot(id, data);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新失败" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await deleteSpot(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 400 });
  }
}
