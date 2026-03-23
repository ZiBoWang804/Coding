import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSearchHistory, createSpot, listSpots } from "@/lib/repository";
import { normalizeSpotInput } from "@/lib/importer";

const querySchema = z.object({
  province: z.string().optional(),
  city: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = querySchema.parse({
    province: searchParams.get("province") || undefined,
    city: searchParams.get("city") || undefined,
    tag: searchParams.get("tag") || undefined,
    q: searchParams.get("q") || undefined
  });

  const items = await listSpots(filters);
  const user = await getCurrentUser();
  if (user && (filters.q || filters.tag || filters.city || filters.province)) {
    void createSearchHistory(user.id, {
      query: filters.q,
      province: filters.province,
      city: filters.city,
      tag: filters.tag,
      resultIds: items.slice(0, 10).map((item) => item.id || "").filter(Boolean)
    });
  }
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  try {
    const payload = await request.json();
    const data = normalizeSpotInput({
      ...payload,
      source: payload.source || "admin_import",
      bestSeason: payload.bestSeason || ["春", "秋"]
    });
    const item = await createSpot(data);
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建失败" }, { status: 400 });
  }
}