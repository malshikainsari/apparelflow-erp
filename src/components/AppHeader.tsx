"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoleSwitcher from "./RoleSwitcher";

export default function AppHeader({ fullName, roleLabel }: { fullName: string; roleLabel: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const shortName = fullName.replace(/\(.*\)/, "").trim();
  const initials = shortName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-black"
            aria-hidden
          >
            AF
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold">ApparelFlow ERP</p>
            <p className="hidden text-xs text-gray-300 sm:block">
              Cutting Verification &amp; Sewing Queue Gate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <RoleSwitcher current={roleLabel} />
          {/* User chip */}
          <div className="flex items-center gap-2.5 rounded-full border border-gray-600 py-1 pl-1 pr-4">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-black"
              aria-hidden
            >
              {initials}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold">{shortName}</p>
              <p className="text-xs text-gray-300">{roleLabel}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            disabled={loggingOut}
            aria-label="Log out"
            className="group inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-70"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:inline">{loggingOut ? "Logging out..." : "Log out"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}