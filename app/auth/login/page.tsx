"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-12">
      <div className="w-full">
        <p className="mb-2 font-semibold text-green-400">FOOTBALL SESSION</p>
        <h1 className="text-4xl font-black">Welcome back</h1>
        <p className="mt-2 text-zinc-400">Sign in to manage your teams.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@email.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

          {error && (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-green-500 px-4 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          New here?{" "}
          <Link href="/auth/register" className="text-green-400 hover:text-green-300">
            Create captain account
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}</span>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none transition focus:border-green-500"
      />
    </label>
  );
}
