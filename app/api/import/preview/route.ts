import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { buildImportPreview, defaultFieldMapping } from "@/lib/importer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  return NextResponse.json({ headers, rows, mapping: defaultFieldMapping(headers) });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const preview = buildImportPreview(body.rows || [], body.mapping || {}, { source: body.source || "admin_import", batch: body.batch || null });
  return NextResponse.json(preview);
}
