"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RegisterTeamForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc("register_team", {
      p_session_id: sessionId,
      p_team_name: teamName.trim()
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/teams/${data}/payment`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="text-xl font-bold">Register your team</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Your slot starts as pending until the organizer verifies the deposit.
      </p>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm text-zinc-300">Team name</span>
        <input
          required
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="FC Tigers"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
        />
      </label>

      {error && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-green-500 px-4 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-50"
      >
        {loading ? "Registering..." : "Register team"}
      </button>
    </form>
  );
}
