import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseId } from "@/lib/http";
import { saveCountsSchema } from "@/lib/schemas";
import { itemStatus } from "@/lib/domain";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("cutting_verifier");
  if ("error" in auth) return auth.error;

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  const parsed = saveCountsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid counts payload" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.cuttingOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) return { status: 404, body: { error: "Order not found" } };
    if (order.status !== "PENDING_VERIFICATION") {
      return { status: 409, body: { error: `Order is ${order.status}; counts can no longer be changed` } };
    }

    const byId = new Map(order.items.map((i) => [i.id, i]));
    const seen = new Set<number>();
    for (const c of parsed.data.counts) {
      if (!byId.has(c.itemId) || seen.has(c.itemId)) {
        return { status: 400, body: { error: "Counts contain an unknown or duplicate component" } };
      }
      seen.add(c.itemId);
    }

    for (const c of parsed.data.counts) {
      await tx.verificationItem.update({
        where: { id: c.itemId },
        data: {
          actualQty: c.actualQty,
          status: itemStatus(c.actualQty, byId.get(c.itemId)!.expectedQty),
        },
      });
    }

    const items = await tx.verificationItem.findMany({ where: { orderId: id }, orderBy: { id: "asc" } });
    return { status: 200, body: { items } };
  });

  return NextResponse.json(result.body, { status: result.status });
}