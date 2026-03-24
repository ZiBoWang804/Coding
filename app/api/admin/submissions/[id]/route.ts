import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { reviewSubmission } from "@/lib/repository";

const schema = z.object({
  decision: z.union([z.literal("APPROVED"), z.literal("REJECTED")]),
  reviewerNotes: z.string().optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const payload = schema.parse(await request.json());
    const { id } = await params;
    const item = await reviewSubmission(id, payload.decision, payload.reviewerNotes);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "审核失败" }, { status: 400 });
  }
}
