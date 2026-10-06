export type ItemStatus = "GREEN" | "YELLOW" | "RED";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 50 garments x 2 cuffs = 100 expected pieces */
export function expectedQty(targetQty: number, piecesPerGarment: number) {
  return targetQty * piecesPerGarment;
}

export function expectedFabricYards(targetQty: number, stdYardsPerPiece: number) {
  return round2(targetQty * stdYardsPerPiece);
}

/** [(Actual - Expected) / Expected] x 100 */
export function wastagePct(actualYds: number, expectedYds: number) {
  if (expectedYds <= 0) throw new Error("Expected fabric must be > 0");
  return round2(((actualYds - expectedYds) / expectedYds) * 100);
}

export function itemStatus(actual: number, expected: number): ItemStatus {
  if (actual === expected) return "GREEN";
  if (actual > expected) return "YELLOW";
  return "RED";
}

export type CountedItem = { expectedQty: number; actualQty: number | null };

/**
 * Pure gatekeeper rule. Works from raw numbers, never from a stored or
 * client-supplied status flag.
 */
export function checkApproval(
  items: CountedItem[]
): { ok: true } | { ok: false; reason: string } {
  if (items.length === 0) return { ok: false, reason: "Order has no components to verify" };
  if (items.some((i) => i.actualQty === null)) {
    return { ok: false, reason: "All components must be counted before approval" };
  }
  if (items.some((i) => (i.actualQty as number) < i.expectedQty)) {
    return { ok: false, reason: "Shortage detected: a RED component blocks approval" };
  }
  return { ok: true };
}