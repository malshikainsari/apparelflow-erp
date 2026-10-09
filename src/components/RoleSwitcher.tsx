"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_PASSWORD = "Demo@1234";
const ROLES = [
  { label: "Cutting Supervisor", email: "supervisor@apparelflow.test", home: "/supervisor" },
  { label: "Cutting Verifier", email: "verifier@apparelflow.test", home: "/verifier" },
  { label: "Sewing Supervisor", email: "sewing@apparelflow.test", home: "/sewing" },
];

export default function RoleSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const target = ROLES.find((r) => r.email === e.target.value);
    if (!target || target.label === current) return;
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.email, password: DEMO_PASSWORD }),
    });
    setBusy(false);
    if (res.ok) {
      router.push(target.home);
      router.refresh();
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-300">
      <span className="hidden md:inline">Switch role</span>
      <select
        value={ROLES.find((r) => r.label === current)?.email ?? ""}
        onChange={onChange}
        disabled={busy}
        aria-label="Switch demo role"
        className="min-h-10 rounded-lg border border-gray-500 bg-black px-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r.email} value={r.email} className="bg-white text-black">
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}