import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const detail = {
  recipe: { select: { name: true, recipeCode: true, wastageCap: true, stdFabricYards: true } },
  items: {
    orderBy: { id: "asc" },
    include: { component: { select: { componentName: true } } },
  },
  logs: {
    where: { decision: "APPROVED" },
    orderBy: { timestamp: "desc" },
    take: 1,
    include: { verifier: { select: { fullName: true } } },
  },
} satisfies Prisma.CuttingOrderInclude;

/** The ONLY query that feeds the sewing floor. Status filter is fixed at the DB level. */
export function getSewingQueue() {
  return prisma.cuttingOrder.findMany({
    where: { status: "VERIFIED" },
    orderBy: { updatedAt: "asc" },
    include: detail,
  });
}

export function getSewingInProgress() {
  return prisma.cuttingOrder.findMany({
    where: { status: "SEWING_STARTED" },
    orderBy: { updatedAt: "desc" },
    include: { recipe: { select: { name: true, recipeCode: true } } },
  });
}