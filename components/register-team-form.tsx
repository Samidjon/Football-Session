"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RegisterTeamForm({ sessionId, maxPlayers }: { sessionId: string; maxPlayers: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState("");
  const [playerLimit, setPlayerLimit] = useState(String(maxPlayers));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc("register_team", {
      p_session_id: sessionId,
      p_team_name: teamName.trim(),
      p_player_limit: Number(playerLimit)
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/teams/${data}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 motm-card-lift">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffcf27]">Free team creation</p>
      <h3 className="mt-2 text-xl font-black">Create a team</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Create the team for free. It will be visible publicly right away. Anyone can then choose Join and pay to reserve their own player place.
      </p>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm text-zinc-300">Team name</span>
        <input
          required
          minLength={2}
          maxLength={70}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="MOTM United"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#ffcf27]"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm text-zinc-300">Number of players</span>
        <select
          required
          value={playerLimit}
          onChange={(e) => setPlayerLimit(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#ffcf27]"
        >
          {Array.from({ length: maxPlayers }, (_, index) => index + 1).map((number) => (
            <option key={number} value={number}>{number} {number === 1 ? "player" : "players"}</option>
          ))}
        </select>
        <span className="mt-2 block text-xs text-zinc-500">You can choose up to {maxPlayers}, as allowed by this session.</span>
      </label>

      {error && <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>}

      <button disabled={loading} className="mt-5 w-full rounded-xl bg-[#ffcf27] px-4 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477] disabled:opacity-50">
        {loading ? "Creating team..." : "Create team — free"}
      </button>
    </form>
  );
}
