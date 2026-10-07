import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Fake only the cookie store; the real JWT signing/verification still runs.
const state = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.token && name === "af_session" ? { value: state.token } : undefined,
  }),
}));

import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";
import { getSewingQueue } from "@/lib/sewing";
import { POST as createOrder } from "@/app/api/orders/route";
import { PUT as saveCounts } from "@/app/api/orders/[id]/counts/route";
import { POST as approve } from "@/app/api/orders/[id]/approve/route";
import { POST as reject } from "@/app/api/orders/[id]/reject/route";

const SUPERVISOR = "supervisor@apparelflow.test";
const VERIFIER = "verifier@apparelflow.test";
const SEWING = "sewing@apparelflow.test";

const created: number[] = [];
let recipeId = 0;

async function loginAs(email: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  state.token = await createSessionToken({ userId: u.id, role: u.role, fullName: u.fullName });
  return u;
}

const req = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

async function makeOrder(): Promise<number> {
  await loginAs(SUPERVISOR);
  const res = await createOrder(
    req("/api/orders", "POST", {
      recipeId,
      targetQty: 10,
      fabricRollId: "TEST-ROLL-1",
      actualFabricYds: 19, // expected 10 x 1.8 = 18 yds
    })
  );
  expect(res.status).toBe(201);
  const order = await res.json();
  created.push(order.id);
  return order.id;
}

/** Verifier counts every component. shortfall > 0 makes the first component short. */
async function countAll(orderId: number, shortfall = 0) {
  const items = await prisma.verificationItem.findMany({
    where: { orderId },
    orderBy: { id: "asc" },
  });
  const counts = items.map((it, idx) => ({
    itemId: it.id,
    actualQty: idx === 0 ? it.expectedQty - shortfall : it.expectedQty,
  }));
  await loginAs(VERIFIER);
  const res = await saveCounts(req(`/api/orders/${orderId}/counts`, "PUT", { counts }), ctx(orderId));
  expect(res.status).toBe(200);
}

const statusOf = async (id: number) =>
  (await prisma.cuttingOrder.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  const recipe = await prisma.recipe.findUniqueOrThrow({ where: { recipeCode: "REC-BL01" } });
  recipeId = recipe.id;
});

afterAll(async () => {
  await prisma.verificationLog.deleteMany({ where: { orderId: { in: created } } });
  await prisma.verificationItem.deleteMany({ where: { orderId: { in: created } } });
  await prisma.cuttingOrder.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

describe("Test 1: all-GREEN order can be approved by a verifier", () => {
  it("approves, moves to VERIFIED and writes the audit log from the session", async () => {
    const id = await makeOrder();
    await countAll(id);

    const verifier = await loginAs(VERIFIER);
    const res = await approve(req(`/api/orders/${id}/approve`, "POST"), ctx(id));
    expect(res.status).toBe(200);

    expect(await statusOf(id)).toBe("VERIFIED");
    const log = await prisma.verificationLog.findFirstOrThrow({ where: { orderId: id } });
    expect(log.decision).toBe("APPROVED");
    expect(log.verifierId).toBe(verifier.id); // taken from the JWT, not the body
    expect(log.wastagePct).toBeCloseTo(5.56, 2); // (19 - 18) / 18 x 100
  });
});

describe("Test 2: a RED (shortage) component blocks approval", () => {
  it("returns 422 and keeps the order PENDING_VERIFICATION", async () => {
    const id = await makeOrder();
    await countAll(id, 1);

    await loginAs(VERIFIER);
    const res = await approve(req(`/api/orders/${id}/approve`, "POST"), ctx(id));
    expect(res.status).toBe(422);
    expect(await statusOf(id)).toBe("PENDING_VERIFICATION");
    expect(await prisma.verificationLog.count({ where: { orderId: id } })).toBe(0);
  });

  it("returns 422 when components are uncounted", async () => {
    const id = await makeOrder();
    await loginAs(VERIFIER);
    const res = await approve(req(`/api/orders/${id}/approve`, "POST"), ctx(id));
    expect(res.status).toBe(422);
    expect(await statusOf(id)).toBe("PENDING_VERIFICATION");
  });
});

describe("Test 3: rejecting without a reason note is refused", () => {
  it("returns 400 for empty, whitespace-only and missing notes", async () => {
    const id = await makeOrder();
    await countAll(id);
    await loginAs(VERIFIER);

    for (const body of [{ note: "" }, { note: "   " }, {}, undefined]) {
      const res = await reject(req(`/api/orders/${id}/reject`, "POST", body), ctx(id));
      expect(res.status).toBe(400);
    }
    expect(await statusOf(id)).toBe("PENDING_VERIFICATION");
  });

  it("accepts a rejection that has a reason and stores it", async () => {
    const id = await makeOrder();
    await loginAs(VERIFIER);
    const res = await reject(
      req(`/api/orders/${id}/reject`, "POST", { note: "3 sleeve cuffs short" }),
      ctx(id)
    );
    expect(res.status).toBe(200);
    expect(await statusOf(id)).toBe("REJECTED");
    const log = await prisma.verificationLog.findFirstOrThrow({ where: { orderId: id } });
    expect(log.rejectionNote).toBe("3 sleeve cuffs short");
  });
});

describe("Test 4: non-verifier roles get 403 (and anonymous gets 401)", () => {
  it("blocks the supervisor and sewing roles from approving or rejecting", async () => {
    const id = await makeOrder();
    await countAll(id);

    for (const email of [SUPERVISOR, SEWING]) {
      await loginAs(email);
      const a = await approve(req(`/api/orders/${id}/approve`, "POST"), ctx(id));
      expect(a.status).toBe(403);
      const r = await reject(req(`/api/orders/${id}/reject`, "POST", { note: "should not work" }), ctx(id));
      expect(r.status).toBe(403);
    }
    expect(await statusOf(id)).toBe("PENDING_VERIFICATION");
  });

  it("blocks the verifier from creating orders", async () => {
    await loginAs(VERIFIER);
    const res = await createOrder(
      req("/api/orders", "POST", { recipeId, targetQty: 5, fabricRollId: "X1", actualFabricYds: 10 })
    );
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const id = await makeOrder();
    state.token = null;
    const res = await approve(req(`/api/orders/${id}/approve`, "POST"), ctx(id));
    expect(res.status).toBe(401);
  });
});

describe("Test 5: unapproved orders never appear in the sewing queue query", () => {
  it("only returns VERIFIED orders", async () => {
    const pending = await makeOrder();

    const rejected = await makeOrder();
    await loginAs(VERIFIER);
    await reject(req(`/api/orders/${rejected}/reject`, "POST", { note: "fabric defect on panels" }), ctx(rejected));

    const verified = await makeOrder();
    await countAll(verified);
    await loginAs(VERIFIER);
    await approve(req(`/api/orders/${verified}/approve`, "POST"), ctx(verified));

    const queue = await getSewingQueue();
    const ids = queue.map((o) => o.id);

    expect(ids).toContain(verified);
    expect(ids).not.toContain(pending);
    expect(ids).not.toContain(rejected);
    expect(queue.every((o) => o.status === "VERIFIED")).toBe(true);
  });
});