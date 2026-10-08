"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = {
  id: string;
  player_name: string;
};

export function EditTeamForm({
  teamId,
  initialTeamName,
  players,
  playerLimit
}: {
  teamId: string;
  initialTeamName: string;
  players: Player[];
  playerLimit: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [teamName, setTeamName] = useState(initialTeamName);
  const [playerNames, setPlayerNames] = useState(
    Object.fromEntries(players.map((player) => [player.id, player.player_name]))
  );
  const [loading, setLoading] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function saveTeam() {
    if (!teamName.trim()) {
      setError("Team name is required.");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("teams")
      .update({ team_name: teamName.trim() })
      .eq("id", teamId);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  async function savePlayer(playerId: string) {
    const name = playerNames[playerId]?.trim();

    if (!name) {
      setError("Player name cannot be empty.");
      return;
    }

    setSavingPlayer(playerId);
    setError("");

    const { error } = await supabase
      .from("team_players")
      .update({ player_name: name })
      .eq("id", playerId);

    if (error) {
      setError(error.message);
      setSavingPlayer(null);
      return;
    }

    setSavingPlayer(null);
    router.refresh();
  }

  async function deletePlayer(playerId: string) {
    const confirmed = window.confirm("Remove this player from your team?");
    if (!confirmed) return;

    setSavingPlayer(playerId);
    setError("");

    const { error } = await supabase
      .from("team_players")
      .delete()
      .eq("id", playerId);

    if (error) {
      setError(error.message);
      setSavingPlayer(null);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-xl font-bold">Team details</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Change the team name at any time. Payment and registration status stay unchanged.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
          />
          <button
            onClick={saveTeam}
            disabled={loading}
            className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save team"}
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Players</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Update or remove any player. The maximum is {playerLimit}.
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {players.length}/{playerLimit}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {players.map((player, index) => (
            <div
              key={player.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="w-8 text-sm text-zinc-600">
                  {index + 1}
                </span>

                <input
                  value={playerNames[player.id] ?? ""}
                  onChange={(event) =>
                    setPlayerNames((current) => ({
                      ...current,
                      [player.id]: event.target.value
                    }))
                  }
                  className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => savePlayer(player.id)}
                    disabled={savingPlayer === player.id}
                    className="rounded-xl border border-green-500/30 px-4 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                  >
                    {savingPlayer === player.id ? "..." : "Save"}
                  </button>

                  <button
                    onClick={() => deletePlayer(player.id)}
                    disabled={savingPlayer === player.id}
                    className="rounded-xl border border-red-900 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
