import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildImportPreview, commitImportRows } from "@/lib/importer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const preview = buildImportPreview(body.rows || [], body.mapping || {}, { source: body.source || "admin_import", batch: body.batch || null });
    const result = await commitImportRows(prisma, preview.normalizedRows, { source: body.source || "admin_import", batch: body.batch || null });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导入失败" }, { status: 400 });
  }
}
