import { NextResponse } from "next/server";
import { prisma, TX_OPTS } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseId } from "@/lib/http";
import { checkApproval, expectedFabricYards, wastagePct } from "@/lib/domain";


export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("cutting_verifier"); // 401 / 403
  if ("error" in auth) return auth.error;

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.cuttingOrder.findUnique({
      where: { id },
      include: { items: true, recipe: true },
    });
    if (!order) return { status: 404, body: { error: "Order not found" } };
    if (order.status !== "PENDING_VERIFICATION") {
      return { status: 409, body: { error: `Order is already ${order.status}` } };
    }

    // HARD STOP: any RED / uncounted component -> 422. Recomputed from raw numbers.
    const check = checkApproval(order.items);
    if (!check.ok) return { status: 422, body: { error: check.reason } };

    const wastage = wastagePct(
      order.actualFabricYds,
      expectedFabricYards(order.targetQty, order.recipe.stdFabricYards)
    );

    // Compare-and-set: only one request can move PENDING -> VERIFIED
    const moved = await tx.cuttingOrder.updateMany({
      where: { id, status: "PENDING_VERIFICATION" },
      data: { status: "VERIFIED" },
    });
    if (moved.count !== 1) return { status: 409, body: { error: "Order state changed, please refresh" } };

    const log = await tx.verificationLog.create({
      data: {
        orderId: id,
        verifierId: auth.session.userId, // from JWT, never from the body
        decision: "APPROVED",
        wastagePct: wastage,
      },
    });
    return { status: 200, body: { status: "VERIFIED", wastagePct: wastage, verifiedAt: log.timestamp } };
    }, TX_OPTS);

  return NextResponse.json(result.body, { status: result.status });
}