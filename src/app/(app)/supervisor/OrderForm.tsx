"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { expectedQty, expectedFabricYards } from "@/lib/domain";

type Recipe = {
  id: number;
  recipeCode: string;
  name: string;
  stdFabricYards: number;
  wastageCap: number;
  components: { id: number; componentName: string; piecesPerGarment: number }[];
};

type Errors = Partial<Record<"recipeId" | "targetQty" | "fabricRollId" | "actualFabricYds" | "form", string>>;

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-sm font-medium text-red-800">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-gray-700">{hint}</span>
      ) : null}
    </label>
  );
}

const baseInput =
  "min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-black";
const inputCls = (hasError?: string) =>
  `${baseInput} ${hasError ? "border-red-700" : "border-gray-400 focus:border-black"}`;

export default function OrderForm({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [recipeId, setRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [fabricRollId, setFabricRollId] = useState("");
  const [yards, setYards] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const recipe = recipes.find((r) => String(r.id) === recipeId);
  const qtyValid = /^[1-9]\d*$/.test(targetQty);
  const qtyNum = qtyValid ? Number(targetQty) : 0;

  const preview = useMemo(() => {
    if (!recipe || !qtyValid) return null;
    return {
      rows: recipe.components.map((c) => ({
        id: c.id,
        name: c.componentName,
        perGarment: c.piecesPerGarment,
        expected: expectedQty(qtyNum, c.piecesPerGarment),
      })),
      fabric: expectedFabricYards(qtyNum, recipe.stdFabricYards),
    };
  }, [recipe, qtyValid, qtyNum]);

  function validate(): Errors {
    const e: Errors = {};
    if (!recipe) e.recipeId = "Select a recipe";
    if (!targetQty.trim()) e.targetQty = "Quantity is required";
    else if (!/^\d+$/.test(targetQty.trim())) e.targetQty = "Whole numbers only (no decimals, negatives or letters)";
    else if (Number(targetQty) < 1) e.targetQty = "Quantity must be greater than 0";
    if (!fabricRollId.trim()) e.fabricRollId = "Fabric roll ID is required";
    else if (!/^[A-Za-z0-9-]+$/.test(fabricRollId.trim())) e.fabricRollId = "Use letters, numbers and hyphens only";
    if (!yards.trim()) e.actualFabricYds = "Fabric used is required";
    else if (!/^\d+(\.\d{1,2})?$/.test(yards.trim())) e.actualFabricYds = "Enter a positive number (max 2 decimals)";
    else if (Number(yards) <= 0) e.actualFabricYds = "Fabric used must be greater than 0";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSuccess("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: Number(recipeId),
        targetQty: Number(targetQty),
        fabricRollId: fabricRollId.trim(),
        actualFabricYds: Number(yards),
      }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors({ ...(data.fields ?? {}), form: data.fields ? undefined : data.error ?? "Request failed" });
      return;
    }
    setSuccess(`Order ${data.orderNo} submitted for verification.`);
    setRecipeId("");
    setTargetQty("");
    setFabricRollId("");
    setYards("");
    setErrors({});
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm"
    >
      <div className="border-b border-gray-300 px-5 py-4">
        <h2 className="text-lg font-semibold text-black">New cutting order</h2>
        <p className="mt-0.5 text-sm text-gray-700">Expected counts are calculated from the recipe.</p>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <Field label="Recipe" error={errors.recipeId}>
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className={inputCls(errors.recipeId)}
            aria-invalid={!!errors.recipeId}
          >
            <option value="" className="bg-white text-gray-900">
              Select a recipe
            </option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id} className="bg-white text-gray-900">
                {r.recipeCode} · {r.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Batch quantity" hint="Whole garments, e.g. 50" error={errors.targetQty}>
            <input
              type="text"
              inputMode="numeric"
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
              className={inputCls(errors.targetQty)}
              placeholder="50"
              aria-invalid={!!errors.targetQty}
            />
          </Field>

          <Field label="Fabric used (yards)" hint="Up to 2 decimals, e.g. 92.5" error={errors.actualFabricYds}>
            <input
              type="text"
              inputMode="decimal"
              value={yards}
              onChange={(e) => setYards(e.target.value)}
              className={inputCls(errors.actualFabricYds)}
              placeholder="92.5"
              aria-invalid={!!errors.actualFabricYds}
            />
          </Field>
        </div>

        <Field label="Fabric roll ID" hint="Letters, numbers and hyphens" error={errors.fabricRollId}>
          <input
            type="text"
            value={fabricRollId}
            onChange={(e) => setFabricRollId(e.target.value)}
            className={inputCls(errors.fabricRollId)}
            placeholder="FAB-ROLL-882"
            aria-invalid={!!errors.fabricRollId}
          />
        </Field>

        {preview && recipe && (
          <div className="overflow-hidden rounded-lg border border-gray-300">
            <div className="bg-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
              Expected components · {recipe.name}
            </div>
            <table className="w-full text-sm text-gray-900">
              <tbody className="divide-y divide-gray-200">
                {preview.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {qtyNum} × {r.perGarment}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.expected} pcs</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              Expected fabric: <span className="font-semibold">{preview.fabric} yds</span>
              <span className="text-gray-700">
                {" "}
                ({qtyNum} × {recipe.stdFabricYards}) · wastage cap {recipe.wastageCap}%
              </span>
            </div>
          </div>
        )}

        {errors.form && (
          <p role="alert" className="rounded-lg border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {errors.form}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg border border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-lg bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit for verification"}
        </button>
      </div>
    </form>
  );
}