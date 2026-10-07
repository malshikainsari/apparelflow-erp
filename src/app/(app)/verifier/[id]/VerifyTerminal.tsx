"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { itemStatus, expectedFabricYards, wastagePct } from "@/lib/domain";
import TrafficLight from "@/components/TrafficLight";
import StatusBadge from "@/components/StatusBadge";

type Item = {
  id: number;
  componentName: string;
  perGarment: number;
  expectedQty: number;
  actualQty: number | null;
};

type Order = {
  id: number;
  orderNo: string;
  status: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  recipe: { name: string; recipeCode: string; stdFabricYards: number; wastageCap: number };
  items: Item[];
  lastLog: {
    decision: string;
    rejectionNote: string | null;
    wastagePct: number;
    timestamp: string;
    verifierName: string;
  } | null;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function VerifyTerminal({ order }: { order: Order }) {
  const router = useRouter();
  const locked = order.status !== "PENDING_VERIFICATION";

  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, i.actualQty === null ? "" : String(i.actualQty)]))
  );
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // ---- live traffic-light evaluation (UX only; the server re-checks everything) ----
  const rows = order.items.map((i) => {
    const raw = (values[i.id] ?? "").trim();
    const valid = /^\d{1,7}$/.test(raw);
    const actual = valid ? Number(raw) : null;
    return {
      ...i,
      actual,
      status: actual === null ? null : itemStatus(actual, i.expectedQty),
      variance: actual === null ? null : actual - i.expectedQty,
    };
  });
  const allCounted = rows.every((r) => r.actual !== null);
  const redCount = rows.filter((r) => r.status === "RED").length;
  const yellowCount = rows.filter((r) => r.status === "YELLOW").length;
  const greenCount = rows.filter((r) => r.status === "GREEN").length;
  const uncounted = rows.filter((r) => r.actual === null).length;
  const canApprove = !locked && allCounted && redCount === 0 && !busy;

  const expectedFabric = expectedFabricYards(order.targetQty, order.recipe.stdFabricYards);
  const wastage = wastagePct(order.actualFabricYds, expectedFabric);
  const overCap = wastage > order.recipe.wastageCap;

  function collectCounts() {
    const errs: Record<number, string> = {};
    const counts: { itemId: number; actualQty: number }[] = [];
    for (const i of order.items) {
      const v = (values[i.id] ?? "").trim();
      if (v === "") continue;
      if (!/^\d{1,7}$/.test(v)) errs[i.id] = "Whole numbers only (0 or more)";
      else counts.push({ itemId: i.id, actualQty: Number(v) });
    }
    setFieldErrors(errs);
    return Object.keys(errs).length ? null : counts;
  }

  async function saveCounts(counts: { itemId: number; actualQty: number }[]) {
    if (counts.length === 0) return true;
    const res = await fetch(`/api/orders/${order.id}/counts`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ counts }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: d.error ?? "Could not save counts" });
      return false;
    }
    return true;
  }

  async function onSave() {
    setMessage(null);
    const counts = collectCounts();
    if (!counts) return;
    if (counts.length === 0) {
      setMessage({ type: "error", text: "Enter at least one count first." });
      return;
    }
    setBusy(true);
    const ok = await saveCounts(counts);
    setBusy(false);
    if (ok) {
      setMessage({ type: "success", text: "Counts saved." });
      router.refresh();
    }
  }

  async function onApprove() {
    setMessage(null);
    const counts = collectCounts();
    if (!counts) return;
    setBusy(true);
    if (!(await saveCounts(counts))) return setBusy(false);

    const res = await fetch(`/api/orders/${order.id}/approve`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ type: "error", text: d.error ?? "Approval failed" });
      return;
    }
    setMessage({ type: "success", text: "Batch verified and released to the Sewing Queue." });
    router.refresh();
  }

  async function onReject() {
    setMessage(null);
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setNoteError("A rejection reason is required (at least 5 characters).");
      return;
    }
    setNoteError("");
    const counts = collectCounts();
    if (!counts) return;
    setBusy(true);
    if (!(await saveCounts(counts))) return setBusy(false);

    const res = await fetch(`/api/orders/${order.id}/reject`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ note: trimmed }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (d.fields?.note) setNoteError(d.fields.note);
      else setMessage({ type: "error", text: d.error ?? "Rejection failed" });
      return;
    }
    setMessage({ type: "success", text: "Batch rejected and returned to the Cutting Supervisor." });
    setShowReject(false);
    router.refresh();
  }

  const inputBase =
    "min-h-11 w-28 rounded-lg border bg-white px-3 py-2 text-right text-base text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:bg-gray-100";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/verifier" className="text-sm font-semibold text-gray-900 underline underline-offset-2">
          ← Back to queue
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-black">{order.orderNo}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-gray-700">
          {order.recipe.name} ({order.recipe.recipeCode}) · {order.targetQty} garments · Roll {order.fabricRollId}
        </p>
      </div>

      {locked && order.lastLog && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            order.lastLog.decision === "APPROVED"
              ? "border-green-700 bg-green-50 text-green-900"
              : "border-red-700 bg-red-50 text-red-900"
          }`}
        >
          <p className="font-semibold">
            {order.lastLog.decision === "APPROVED" ? "Verified" : "Rejected"} by {order.lastLog.verifierName} on{" "}
            {new Date(order.lastLog.timestamp).toLocaleString("en-GB")}
          </p>
          <p className="mt-0.5">Fabric wastage recorded: {order.lastLog.wastagePct}%</p>
          {order.lastLog.rejectionNote && <p className="mt-0.5">Reason: {order.lastLog.rejectionNote}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Component count table */}
        <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 px-5 py-4">
            <h2 className="text-lg font-semibold text-black">Component count</h2>
            <p className="text-sm text-gray-700">
              {greenCount} match · {yellowCount} excess · {redCount} shortage · {uncounted} not counted
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-900">
                <tr>
                  <th className="px-5 py-3 font-semibold">Component</th>
                  <th className="px-3 py-3 text-right font-semibold">Expected</th>
                  <th className="px-3 py-3 text-right font-semibold">Counted</th>
                  <th className="px-3 py-3 text-right font-semibold">Variance</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-900">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <span className="block font-medium">{r.componentName}</span>
                      <span className="block text-xs text-gray-700">
                        {order.targetQty} × {r.perGarment}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{r.expectedQty}</td>
                    <td className="px-3 py-3 text-right align-top">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Counted pieces for ${r.componentName}`}
                        aria-invalid={!!fieldErrors[r.id]}
                        disabled={locked || busy}
                        value={values[r.id] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                        className={`${inputBase} ${fieldErrors[r.id] ? "border-red-700" : "border-gray-400"}`}
                        placeholder="0"
                      />
                      {fieldErrors[r.id] && (
                        <span role="alert" className="mt-1 block text-xs font-medium text-red-800">
                          {fieldErrors[r.id]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.variance === null ? "–" : r.variance > 0 ? `+${r.variance}` : r.variance}
                    </td>
                    <td className="px-5 py-3">
                      <TrafficLight status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Fabric + decision panel */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-black">Fabric usage</h2>
            <dl className="mt-3 space-y-2 text-sm text-gray-900">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-700">Expected</dt>
                <dd className="font-semibold tabular-nums">{expectedFabric} yds</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-700">Actual used</dt>
                <dd className="font-semibold tabular-nums">{order.actualFabricYds} yds</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-gray-200 pt-2">
                <dt className="text-gray-700">Wastage</dt>
                <dd className="font-bold tabular-nums">{wastage}%</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-700">Cap</dt>
                <dd className="font-semibold tabular-nums">{order.recipe.wastageCap}%</dd>
              </div>
            </dl>
            {overCap && (
              <p className="mt-3 rounded-lg border border-amber-700 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Wastage is above the recipe cap. This does not block approval, but it is recorded in the audit trail.
              </p>
            )}
          </section>

          {!locked && (
            <section className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Decision</h2>

              {redCount > 0 && (
                <p role="alert" className="mt-3 rounded-lg border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {redCount} component{redCount > 1 ? "s have" : " has"} a shortage. Approval is blocked. Reject
                  the batch with a reason for re-cutting.
                </p>
              )}
              {redCount === 0 && !allCounted && (
                <p className="mt-3 text-sm text-gray-700">Count every component to enable approval.</p>
              )}

              {message && (
                <p
                  role={message.type === "error" ? "alert" : "status"}
                  className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${
                    message.type === "error"
                      ? "border-red-700 bg-red-50 text-red-800"
                      : "border-green-700 bg-green-50 text-green-900"
                  }`}
                >
                  {message.text}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-3">
                <button
                  onClick={onSave}
                  disabled={busy}
                  className="min-h-11 rounded-lg border border-gray-900 bg-white px-4 font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-60"
                >
                  Save counts
                </button>
                <button
                  onClick={onApprove}
                  disabled={!canApprove}
                  className="min-h-11 rounded-lg bg-black px-4 font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-700"
                >
                  Approve batch
                </button>
                <button
                  onClick={() => setShowReject((s) => !s)}
                  disabled={busy}
                  className="min-h-11 rounded-lg border border-red-800 bg-white px-4 font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-800 disabled:opacity-60"
                >
                  Reject batch
                </button>
              </div>

              {showReject && (
                <div className="mt-4 space-y-2">
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                    Rejection reason (required)
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      maxLength={500}
                      aria-invalid={!!noteError}
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-base font-normal text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-black ${
                        noteError ? "border-red-700" : "border-gray-400"
                      }`}
                      placeholder="e.g. 3 sleeve cuffs short, fabric defect on front panels"
                    />
                  </label>
                  {noteError && (
                    <p role="alert" className="text-sm font-medium text-red-800">
                      {noteError}
                    </p>
                  )}
                  <button
                    onClick={onReject}
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg bg-red-800 px-4 font-semibold text-white hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 disabled:opacity-60"
                  >
                    Confirm rejection
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}