"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Account created. Check your email if Supabase email confirmation is enabled."
    );
    setLoading(false);

    setTimeout(() => {
      router.push("/auth/login");
      router.refresh();
    }, 1400);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-12">
      <div className="w-full">
        <p className="mb-2 font-semibold text-[#ffcf27]">MOTM FOOTBALL</p>
        <h1 className="text-4xl font-black">Create your account</h1>
        <p className="mt-2 text-zinc-400">Every new account starts as Captain.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Ahmad Rahman" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+60 12 345 6789" />
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@email.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" minLength={6} />

          {error && (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-[#ffcf27]/30 bg-[#ffcf27]/10 p-4 text-sm text-[#ffe477]">
              {message}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-[#ffcf27] px-4 py-3 font-semibold text-black hover:bg-[#ffe477] disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create captain account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#ffcf27] hover:text-[#ffe477]">
            Sign in
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
  placeholder,
  type = "text",
  minLength
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}</span>
      <input
        required
        type={type}
        minLength={minLength}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none transition focus:border-[#1559ad]"
      />
    </label>
  );
}
