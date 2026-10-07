import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StatusBadge from "@/components/StatusBadge";

export default async function VerifierQueuePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "cutting_verifier") redirect("/dashboard");

  const orders = await prisma.cuttingOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { recipe: { select: { name: true, recipeCode: true } } },
  });
  const pending = orders.filter((o) => o.status === "PENDING_VERIFICATION");
  const decided = orders.filter((o) => o.status !== "PENDING_VERIFICATION");

  const Table = ({ rows, action }: { rows: typeof orders; action: string }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-900">
          <tr>
            <th className="px-5 py-3 font-semibold">Order</th>
            <th className="px-3 py-3 font-semibold">Recipe</th>
            <th className="px-3 py-3 text-right font-semibold">Qty</th>
            <th className="px-3 py-3 font-semibold">Fabric roll</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 text-right font-semibold">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-gray-900">
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-5 py-3 font-mono font-semibold">{o.orderNo}</td>
              <td className="px-3 py-3">
                <span className="block font-medium">{o.recipe.name}</span>
                <span className="block text-xs text-gray-700">{o.recipe.recipeCode}</span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{o.targetQty}</td>
              <td className="px-3 py-3">{o.fabricRollId}</td>
              <td className="px-3 py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={`/verifier/${o.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                >
                  {action}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Cutting Verification Terminal</h1>
        <p className="mt-1 text-sm text-gray-700">
          Count physical parts for each batch. Only fully matching batches can be released to sewing.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold text-black">Awaiting verification</h2>
          <span className="text-sm text-gray-700">{pending.length} batches</span>
        </div>
        {pending.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-gray-900">No batches waiting at the QC station</p>
            <p className="mt-1 text-sm text-gray-700">New orders from the Cutting Supervisor appear here.</p>
          </div>
        ) : (
          <Table rows={pending} action="Verify" />
        )}
      </section>

      {decided.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
          <div className="border-b border-gray-300 px-5 py-4">
            <h2 className="text-lg font-semibold text-black">Decided batches</h2>
          </div>
          <Table rows={decided} action="View" />
        </section>
      )}
    </div>
  );
}