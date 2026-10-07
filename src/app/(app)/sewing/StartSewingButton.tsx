"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartSewingButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/start-sewing`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not start sewing");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-black px-4 font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Starting..." : "Start Sewing Assembly"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}