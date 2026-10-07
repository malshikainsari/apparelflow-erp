import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StatusBadge from "@/components/StatusBadge";
import OrderForm from "./OrderForm";

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{label}</p>
      <p className="mt-1 text-3xl font-bold text-black">{value}</p>
      <p className="mt-1 text-xs text-gray-700">{hint}</p>
    </div>
  );
}

export default async function SupervisorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "cutting_supervisor") redirect("/dashboard");

  const [recipes, orders] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: { recipeCode: "asc" },
      include: { components: { orderBy: { id: "asc" } } },
    }),
    prisma.cuttingOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
  recipe: { select: { name: true, recipeCode: true } },
  logs: { orderBy: { timestamp: "desc" }, take: 1, select: { rejectionNote: true } },
},
    }),
  ]);

  const count = (s: string) => orders.filter((o) => o.status === s).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Cutting Supervisor Workspace</h1>
        <p className="mt-1 text-sm text-gray-700">
          Create cutting orders and track them through verification.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total orders" value={orders.length} hint="All cutting orders" />
        <StatCard label="Pending" value={count("PENDING_VERIFICATION")} hint="Waiting at QC station" />
        <StatCard label="Rejected" value={count("REJECTED")} hint="Returned for re-cutting" />
        <StatCard
          label="Verified"
          value={count("VERIFIED") + count("SEWING_STARTED")}
          hint="Released to sewing"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <section className="lg:sticky lg:top-6 lg:col-span-2">
          <OrderForm recipes={recipes} />
        </section>

        <section className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold text-black">Cutting orders</h2>
              <span className="text-sm text-gray-700">{orders.length} total</span>
            </div>

            {orders.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-base font-semibold text-gray-900">No cutting orders yet</p>
                <p className="mt-1 text-sm text-gray-700">
                  Use the form to create the first order. It will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-900">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Order</th>
                      <th className="px-3 py-3 font-semibold">Recipe</th>
                      <th className="px-3 py-3 text-right font-semibold">Qty</th>
                      <th className="px-3 py-3 font-semibold">Fabric roll</th>
                      <th className="px-3 py-3 text-right font-semibold">Yards</th>
                      <th className="px-3 py-3 font-semibold">Created</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-900">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-5 py-3 font-mono font-semibold">{o.orderNo}</td>
                        <td className="px-3 py-3">
                          <span className="block font-medium">{o.recipe.name}</span>
                          <span className="block text-xs text-gray-700">{o.recipe.recipeCode}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{o.targetQty}</td>
                        <td className="px-3 py-3">{o.fabricRollId}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{o.actualFabricYds}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                          {new Date(o.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={o.status} />
                          {o.status === "REJECTED" && o.logs[0]?.rejectionNote && (
                            <p className="mt-1 max-w-[220px] text-xs text-red-900">Reason: {o.logs[0].rejectionNote}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}