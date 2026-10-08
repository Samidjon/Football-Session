"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
