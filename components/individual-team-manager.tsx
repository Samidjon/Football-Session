"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; player_name: string };

export function IndividualTeamManager({
  teamId,
  initialTeamName,
  initialPlayers,
  depositAmount,
  status
}: {
  teamId: string;
  initialTeamName: string;
  initialPlayers: Player[];
  depositAmount: number;
  status: "not_counted" | "counted" | "cancelled";
}) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState(initialTeamName);
  const [players, setPlayers] = useState(initialPlayers);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function renameTeam() {
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("rename_individual_team", {
      p_team_id: teamId,
      p_team_name: teamName.trim()
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    const name = newPlayerName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setBusy(false);
      return setError("Please sign in again.");
    }
    const { data: team } = await supabase.from("individual_teams").select("captain_id").eq("id", teamId).single();
    if (team?.captain_id !== userData.user.id) {
      setBusy(false);
      return setError("Only the captain can manage this squad.");
    }
    const { data, error } = await supabase.from("individual_players").insert({ individual_team_id: teamId, player_name: name }).select("id, player_name").single();
    setBusy(false);
    if (error) return setError(error.message);
    setPlayers((current) => [...current, data]);
    setNewPlayerName("");
    router.refresh();
  }

  async function renamePlayer(player: Player, newName: string) {
    const name = newName.trim();
    if (!name) return setError("Player name cannot be empty.");
    setBusy(true);
    setError("");
    const { error } = await supabase.from("individual_players").update({ player_name: name }).eq("id", player.id);
    setBusy(false);
    if (error) return setError(error.message);
    setPlayers((current) => current.map((p) => p.id === player.id ? { ...p, player_name: name } : p));
    router.refresh();
  }

  async function removePlayer(player: Player) {
    if (!window.confirm(`Remove ${player.player_name} from the squad?`)) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("individual_players").delete().eq("id", player.id);
    setBusy(false);
    if (error) return setError(error.message);
    setPlayers((current) => current.filter((p) => p.id !== player.id));
    router.refresh();
  }

  async function deleteTeam() {
    if (!window.confirm("Delete this unpaid individual team? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("delete_individual_team", { p_team_id: teamId });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/individuals");
    router.refresh();
  }

  const canManage = status !== "cancelled";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-xl font-bold">Team details</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input maxLength={70} value={teamName} onChange={(event) => setTeamName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]" />
          <button type="button" disabled={busy || !canManage} onClick={renameTeam} className="rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] disabled:opacity-50">Save team name</button>
        </div>
        <p className="mt-3 text-sm text-zinc-500">Deposit: RM {depositAmount.toFixed(2)} · Status: {status === "counted" ? "Counted" : status === "not_counted" ? "Not counted" : "Cancelled"}</p>
        {status === "not_counted" && <a href={`/individuals/teams/${teamId}/payment`} className="mt-4 inline-flex rounded-xl bg-[#1559ad] px-5 py-3 font-semibold text-white hover:bg-[#1b67c4]">Pay deposit</a>}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div><h2 className="text-2xl font-bold">Squad members</h2><p className="mt-1 text-sm text-zinc-500">Add up to 30 players. The roster is public, even before payment.</p></div>
          <span className="text-sm text-zinc-500">{players.length}/30</span>
        </div>
        <div className="mt-5 space-y-3">
          {players.map((player, index) => <IndividualPlayerRow key={player.id} index={index + 1} player={player} busy={busy || !canManage} onSave={renamePlayer} onRemove={removePlayer} />)}
        </div>
        {players.length < 30 && canManage && (
          <form onSubmit={addPlayer} className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <label className="block text-sm font-semibold">Add player</label>
            <div className="mt-3 flex gap-2">
              <input required maxLength={100} value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="Player full name" className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]" />
              <button disabled={busy} className="rounded-xl bg-[#ffcf27] px-4 py-3 font-bold text-[#101522] disabled:opacity-50">Add</button>
            </div>
          </form>
        )}
      </section>

      {status === "not_counted" && <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5"><h3 className="font-bold text-red-300">Delete unpaid team</h3><p className="mt-1 text-sm text-zinc-400">A team that has already paid cannot be deleted here; contact the organizer for cancellation or refund.</p><button disabled={busy} onClick={deleteTeam} className="mt-4 rounded-xl border border-red-900 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/40">Delete team</button></section>}

      {error && <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>}
    </div>
  );
}

function IndividualPlayerRow({ index, player, busy, onSave, onRemove }: { index: number; player: Player; busy: boolean; onSave: (player: Player, name: string) => Promise<void>; onRemove: (player: Player) => Promise<void> }) {
  const [name, setName] = useState(player.player_name);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center">
      <span className="w-8 text-sm text-zinc-500">{index}</span>
      <input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]" />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => onSave(player, name)} className="rounded-xl border border-[#ffcf27]/30 px-4 py-3 text-sm font-semibold text-[#ffcf27] disabled:opacity-50">Save</button>
        <button type="button" disabled={busy} onClick={() => onRemove(player)} className="rounded-xl border border-red-900 px-4 py-3 text-sm font-semibold text-red-300 disabled:opacity-50">Remove</button>
      </div>
    </div>
  );
}
