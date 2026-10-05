"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMOS = [
  { label: "Cutting Supervisor", desc: "Creates cutting orders", email: "supervisor@apparelflow.test", icon: "✂️" },
  { label: "Cutting Verifier", desc: "Counts parts & approves", email: "verifier@apparelflow.test", icon: "✅" },
  { label: "Sewing Supervisor", desc: "Receives verified batches", email: "sewing@apparelflow.test", icon: "🧵" },
];
const DEMO_PASSWORD = "Demo@1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-400 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-500 shadow-sm focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 text-slate-900">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 md:grid-cols-2">
        {/* Left: brand panel */}
        <section className="flex flex-col justify-between bg-indigo-900 p-8 text-white">
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl">
              🧵
            </div>
            <h1 className="text-3xl font-bold leading-tight">ApparelFlow ERP</h1>
            <p className="mt-2 text-indigo-100">
              Cutting Verification &amp; Sewing Queue Gate
            </p>
          </div>
          <ul className="mt-8 space-y-3 text-sm text-indigo-50">
            <li className="flex items-start gap-2">
              <span aria-hidden>🔒</span>
              Server-enforced role-based access
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>🚦</span>
              Traffic-light component verification
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>📋</span>
              Immutable audit trail for every batch
            </li>
          </ul>
        </section>

        {/* Right: form */}
        <section className="p-8">
          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-700">Sign in to continue to your workspace.</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-900">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@apparelflow.test"
                autoComplete="username"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-900">
              Password
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-16`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-800 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Demo accounts (click to fill)
            </h3>
            <div className="mt-3 grid gap-2">
              {DEMOS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASSWORD);
                    setError("");
                  }}
                  className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left transition hover:border-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg" aria-hidden>
                    {d.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{d.label}</span>
                    <span className="block text-xs text-slate-700">{d.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}