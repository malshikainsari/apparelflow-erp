import { describe, it, expect } from "vitest";
import {
  expectedQty,
  expectedFabricYards,
  wastagePct,
  itemStatus,
  checkApproval,
} from "@/lib/domain";

describe("domain rules", () => {
  it("multiplies pieces per garment into expected counts", () => {
    expect(expectedQty(50, 2)).toBe(100);
    expect(expectedFabricYards(50, 1.8)).toBe(90);
  });

  it("evaluates the traffic light", () => {
    expect(itemStatus(100, 100)).toBe("GREEN");
    expect(itemStatus(101, 100)).toBe("YELLOW");
    expect(itemStatus(99, 100)).toBe("RED");
    expect(itemStatus(0, 100)).toBe("RED");
  });

  it("computes fabric wastage percentage", () => {
    expect(wastagePct(92.5, 90)).toBe(2.78);
    expect(wastagePct(68, 108)).toBe(-37.04);
  });

  it("gatekeeper allows only fully counted, shortage-free batches", () => {
    expect(checkApproval([{ expectedQty: 10, actualQty: 10 }, { expectedQty: 4, actualQty: 6 }]).ok).toBe(true);
    expect(checkApproval([{ expectedQty: 10, actualQty: 9 }]).ok).toBe(false);
    expect(checkApproval([{ expectedQty: 10, actualQty: null }]).ok).toBe(false);
    expect(checkApproval([]).ok).toBe(false);
  });
});