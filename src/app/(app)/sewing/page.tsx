import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSewingQueue, getSewingInProgress } from "@/lib/sewing";
import TrafficLight from "@/components/TrafficLight";
import StatusBadge from "@/components/StatusBadge";
import StartSewingButton from "./StartSewingButton";

export default async function SewingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "sewing_supervisor") redirect("/dashboard");

  const [queue, inProgress] = await Promise.all([getSewingQueue(), getSewingInProgress()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Sewing Queue</h1>
        <p className="mt-1 text-sm text-gray-700">
          Only batches verified by the Cutting Verifier appear here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Ready to sew</p>
          <p className="mt-1 text-3xl font-bold text-black">{queue.length}</p>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">In assembly</p>
          <p className="mt-1 text-3xl font-bold text-black">{inProgress.length}</p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-xl border border-gray-300 bg-white px-5 py-12 text-center shadow-sm">
          <p className="font-semibold text-gray-900">No verified batches waiting</p>
          <p className="mt-1 text-sm text-gray-700">Batches appear here after the Cutting Verifier approves them.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {queue.map((o) => {
            const log = o.logs[0];
            const verifier = log?.verifier.fullName.replace(/\(.*\)/, "").trim();
            return (
              <article key={o.id} className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-300 px-5 py-4">
                  <div>
                    <h2 className="font-mono text-lg font-bold text-black">{o.orderNo}</h2>
                    <p className="text-sm text-gray-700">
                      {o.recipe.name} ({o.recipe.recipeCode}) · {o.targetQty} garments · Roll {o.fabricRollId}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                {log && (
                  <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-900">
                    <p>
                      Verified by <span className="font-semibold">{verifier}</span> on{" "}
                      {new Date(log.timestamp).toLocaleString("en-GB")}
                    </p>
                    <p className="mt-0.5">
                      Fabric wastage: <span className="font-semibold">{log.wastagePct}%</span>{" "}
                      <span className="text-gray-700">(cap {o.recipe.wastageCap}%)</span>
                    </p>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-900">
                      <tr>
                        <th className="px-5 py-2.5 font-semibold">Component</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Expected</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Counted</th>
                        <th className="px-5 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-900">
                      {o.items.map((i) => (
                        <tr key={i.id}>
                          <td className="px-5 py-2.5">{i.component.componentName}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{i.expectedQty}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{i.actualQty}</td>
                          <td className="px-5 py-2.5">
                            <TrafficLight status={i.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-300 px-5 py-4">
                  <StartSewingButton orderId={o.id} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {inProgress.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
          <div className="border-b border-gray-300 px-5 py-4">
            <h2 className="text-lg font-semibold text-black">In assembly</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-900">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Recipe</th>
                  <th className="px-3 py-3 text-right font-semibold">Qty</th>
                  <th className="px-5 py-3 font-semibold">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-900">
                {inProgress.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono font-semibold">{o.orderNo}</td>
                    <td className="px-3 py-3">{o.recipe.name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.targetQty}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-700">
                      {new Date(o.updatedAt).toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}