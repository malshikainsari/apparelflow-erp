import { NextResponse } from "next/server";
import { prisma, TX_OPTS } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseId } from "@/lib/http";
import { rejectSchema } from "@/lib/schemas";
import { expectedFabricYards, wastagePct } from "@/lib/domain";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole("cutting_verifier");
  if ("error" in auth && auth.error) return auth.error;

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  const parsed = rejectSchema.safeParse(
  await req.json().catch((): null => null)
);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A rejection reason is required", fields: { note: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.cuttingOrder.findUnique({ where: { id }, include: { recipe: true } });
    if (!order) return { status: 404, body: { error: "Order not found" } };
    if (order.status !== "PENDING_VERIFICATION") {
      return { status: 409, body: { error: `Order is already ${order.status}` } };
    }

    const moved = await tx.cuttingOrder.updateMany({
      where: { id, status: "PENDING_VERIFICATION" },
      data: { status: "REJECTED" },
    });
    if (moved.count !== 1) return { status: 409, body: { error: "Order state changed, please refresh" } };

    await tx.verificationLog.create({
      data: {
        orderId: id,
        verifierId: auth.session.userId,
        decision: "REJECTED",
        rejectionNote: parsed.data.note,
        wastagePct: wastagePct(
          order.actualFabricYds,
          expectedFabricYards(order.targetQty, order.recipe.stdFabricYards)
        ),
      },
    });
    return { status: 200, body: { status: "REJECTED" } };
    }, TX_OPTS);

  return NextResponse.json(result.body, { status: result.status });
}