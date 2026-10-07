import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/http";
import VerifyTerminal from "./VerifyTerminal";

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "cutting_verifier") redirect("/dashboard");

  const id = parseId((await params).id);
  if (!id) notFound();

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      recipe: true,
      items: { orderBy: { id: "asc" }, include: { component: true } },
      logs: {
        orderBy: { timestamp: "desc" },
        take: 1,
        include: { verifier: { select: { fullName: true } } },
      },
    },
  });
  if (!order) notFound();

  const log = order.logs[0];

  return (
    <VerifyTerminal
      order={{
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        targetQty: order.targetQty,
        fabricRollId: order.fabricRollId,
        actualFabricYds: order.actualFabricYds,
        recipe: {
          name: order.recipe.name,
          recipeCode: order.recipe.recipeCode,
          stdFabricYards: order.recipe.stdFabricYards,
          wastageCap: order.recipe.wastageCap,
        },
        items: order.items.map((i) => ({
          id: i.id,
          componentName: i.component.componentName,
          perGarment: i.component.piecesPerGarment,
          expectedQty: i.expectedQty,
          actualQty: i.actualQty,
        })),
        lastLog: log
          ? {
              decision: log.decision,
              rejectionNote: log.rejectionNote,
              wastagePct: log.wastagePct,
              timestamp: log.timestamp.toISOString(),
              verifierName: log.verifier.fullName.replace(/\(.*\)/, "").trim(),
            }
          : null,
      }}
    />
  );
}