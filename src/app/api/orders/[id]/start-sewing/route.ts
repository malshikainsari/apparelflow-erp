import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseId } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("sewing_supervisor");
  if ("error" in auth) return auth.error;

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  // Compare-and-set: only a VERIFIED order can move on.
  const moved = await prisma.cuttingOrder.updateMany({
    where: { id, status: "VERIFIED" },
    data: { status: "SEWING_STARTED" },
  });
  if (moved.count !== 1) {
    return NextResponse.json({ error: "Order not found in the sewing queue" }, { status: 404 });
  }
  return NextResponse.json({ status: "SEWING_STARTED" });
}