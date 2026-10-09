"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResubmitButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function resubmit() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/resubmit`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not re-submit");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        onClick={resubmit}
        disabled={busy}
        className="min-h-9 rounded-lg border border-gray-900 bg-white px-3 text-xs font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-60"
      >
        {busy ? "Re-submitting..." : "Re-submit for verification"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}