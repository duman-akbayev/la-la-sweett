"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-espresso px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/images/logo/Logo.svg"
            alt="La La Sweett"
            width={48}
            height={48}
            className="mx-auto h-12 w-auto brightness-150"
          />
          <h1 className="mt-4 font-script text-2xl text-brand-rose-light">
            La La Sweett
          </h1>
          <p className="mt-1 text-sm text-white/40">Admin Console</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-card bg-white/[0.04] p-8 backdrop-blur-sm"
        >
          {error && (
            <div className="mb-4 rounded-input bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
              {error}
            </div>
          )}

          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/50">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            className="w-full rounded-input border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-brand-rose/50 focus:outline-none focus:ring-2 focus:ring-brand-rose/20"
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-5 w-full rounded-button bg-brand-rose py-3 text-sm font-medium text-white transition-all hover:bg-brand-rose-light disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/20">
          Protected area. Authorized access only.
        </p>
      </div>
    </div>
  );
}
