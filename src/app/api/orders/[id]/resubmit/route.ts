import { NextResponse } from "next/server";
import { prisma, TX_OPTS } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseId } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("cutting_supervisor");
  if ("error" in auth) return auth.error;

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    // Compare-and-set: only a REJECTED order can go back to the QC station.
    const moved = await tx.cuttingOrder.updateMany({
      where: { id, status: "REJECTED" },
      data: { status: "PENDING_VERIFICATION" },
    });
    if (moved.count !== 1) {
      return { status: 409, body: { error: "Only rejected orders can be re-submitted" } };
    }
    // Fresh count for the re-cut batch. The rejection stays in verification_logs.
    await tx.verificationItem.updateMany({
      where: { orderId: id },
      data: { actualQty: null, status: null },
    });
    return { status: 200, body: { status: "PENDING_VERIFICATION" } };
  }, TX_OPTS);

  return NextResponse.json(result.body, { status: result.status });
}