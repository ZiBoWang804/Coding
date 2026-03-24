import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseEnabled } from "@/lib/database-mode";
import { createRuntimeDemoSpot, listRuntimeDemoSpots, updateRuntimeDemoSpot } from "@/lib/demo-spot-store";
import { buildImportPreview, buildSpotLookupKey, commitImportRows } from "@/lib/importer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function ensureAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "没有管理员权限" }, { status: 403 });
  }
  return null;
}

async function commitInDemoMode(
  rows: Array<ReturnType<typeof buildImportPreview>["normalizedRows"][number]>
) {
  let created = 0;
  let updated = 0;
  const failed: Array<{ name: string; reason: string }> = [];

  const existingSpots = await listRuntimeDemoSpots();
  const existingMap = new Map(existingSpots.map((spot) => [buildSpotLookupKey(spot), spot]));

  for (const row of rows) {
    try {
      const key = buildSpotLookupKey(row);
      const existing = existingMap.get(key);
      if (existing?.id) {
        const next = await updateRuntimeDemoSpot(existing.id, row);
        existingMap.set(key, next);
        updated += 1;
      } else {
        const next = await createRuntimeDemoSpot(row);
        existingMap.set(key, next);
        created += 1;
      }
    } catch (error) {
      failed.push({
        name: row.name,
        reason: error instanceof Error ? error.message : "导入失败"
      });
    }
  }

  return { created, updated, failed };
}

export async function POST(request: Request) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const preview = buildImportPreview(body.rows || [], body.mapping || {}, {
      source: body.source || "admin_import",
      batch: body.batch || null
    });

    if (!isDatabaseEnabled()) {
      const result = await commitInDemoMode(preview.normalizedRows);
      return NextResponse.json(result);
    }

    const result = await commitImportRows(prisma, preview.normalizedRows, {
      source: body.source || "admin_import",
      batch: body.batch || null
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导入失败" }, { status: 400 });
  }
}
