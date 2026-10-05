"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMOS = [
  { label: "Cutting Supervisor", desc: "Creates cutting orders", email: "supervisor@apparelflow.test" },
  { label: "Cutting Verifier", desc: "Counts parts, approves or rejects", email: "verifier@apparelflow.test" },
  { label: "Sewing Supervisor", desc: "Receives verified batches", email: "sewing@apparelflow.test" },
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
    "w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-gray-900 placeholder-gray-600 focus:border-black focus:outline-none focus:ring-2 focus:ring-black";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4 text-gray-900">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-black">ApparelFlow ERP</h1>
          <p className="mt-1 text-sm text-gray-700">
            Cutting Verification &amp; Sewing Queue Gate
          </p>
        </header>

        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-black">Sign in</h2>

          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
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

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-100"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <section className="mt-4 rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Demo accounts (click to fill)
          </h3>
          <ul className="mt-3 divide-y divide-gray-200">
            {DEMOS.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASSWORD);
                    setError("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{d.label}</span>
                    <span className="block text-xs text-gray-700">{d.desc}</span>
                  </span>
                  <span className="text-xs font-medium text-gray-700">{d.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}