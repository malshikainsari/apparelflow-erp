import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createOrderSchema } from "@/lib/schemas";
import { expectedQty } from "@/lib/domain";

export async function GET() {
  const auth = await requireRole("cutting_supervisor", "cutting_verifier");
  if ("error" in auth) return auth.error;

  const orders = await prisma.cuttingOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { recipe: { select: { name: true, recipeCode: true } } },
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireRole("cutting_supervisor");
  if ("error" in auth && auth.error) return auth.error;

  const body = await req.json().catch((): null => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Validation failed", fields }, { status: 400 });
  }
  const { recipeId, targetQty, fabricRollId, actualFabricYds } = parsed.data;

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { components: true },
  });
  if (!recipe) {
    return NextResponse.json(
      { error: "Validation failed", fields: { recipeId: "Recipe not found" } },
      { status: 404 }
    );
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.cuttingOrder.create({
      data: {
        orderNo: `TMP-${randomUUID()}`,
        recipeId,
        targetQty,
        fabricRollId,
        actualFabricYds,
        status: "PENDING_VERIFICATION",
        createdBy: auth.session.userId, // from the JWT, never from the body
        items: {
          create: recipe.components.map((c) => ({
            componentId: c.id,
            expectedQty: expectedQty(targetQty, c.piecesPerGarment),
          })),
        },
      },
    });
    return tx.cuttingOrder.update({
      where: { id: created.id },
      data: { orderNo: `CUT-${String(created.id).padStart(5, "0")}` },
    });
  });

  return NextResponse.json(order, { status: 201 });
}