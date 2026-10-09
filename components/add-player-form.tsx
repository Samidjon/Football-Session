"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AddPlayerForm({
  teamId,
  disabled
}: {
  teamId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.from("team_players").insert({
      team_id: teamId,
      player_name: name.trim()
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setName("");
    setLoading(false);
    router.refresh();
  }

  if (disabled) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
        Team is full.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="font-bold">Add player</h3>
      <div className="mt-3 flex gap-2">
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Player name"
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]"
        />
        <button
          disabled={loading}
          className="rounded-xl bg-[#ffcf27] px-4 py-3 font-semibold text-black hover:bg-[#ffe477] disabled:opacity-50"
        >
          {loading ? "..." : "Add"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </form>
  );
}
