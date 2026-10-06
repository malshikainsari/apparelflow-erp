import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseId } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("cutting_supervisor", "cutting_verifier");
  if ("error" in auth) return auth.error;

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      recipe: true,
      items: { orderBy: { id: "asc" }, include: { component: true } },
      logs: {
        orderBy: { timestamp: "desc" },
        include: { verifier: { select: { fullName: true } } },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json(order);
}