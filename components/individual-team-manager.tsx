"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "not_counted" | "counted" | "cancelled";

export function IndividualTeamManager({
  teamId, initialTeamName, initialPlayerLimit, depositAmount, status, paidMembers
}: {
  teamId: string;
  initialTeamName: string;
  initialPlayerLimit: number;
  depositAmount: number;
  status: Status;
  paidMembers: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState(initialTeamName);
  const [playerLimit, setPlayerLimit] = useState(String(initialPlayerLimit));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function saveDetails() {
    setBusy(true); setError(""); setMessage("");
    const { error } = await supabase.rpc("update_individual_team_details", {
      p_team_id: teamId,
      p_team_name: teamName.trim(),
      p_player_limit: Number(playerLimit)
    });
    setBusy(false);
    if (error) return setError(error.message);
    setMessage("Team details saved.");
    router.refresh();
  }

  async function deleteTeam() {
    if (!window.confirm("Delete this team? This is only allowed if no participant has paid.")) return;
    setBusy(true); setError("");
    const { error } = await supabase.rpc("delete_individual_team", { p_team_id: teamId });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/individuals");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-xl font-black">Team details</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Creating a team is free. Participants add themselves by signing in and paying individually; you cannot add unpaid names manually.</p>
        <label className="mt-5 block"><span className="mb-2 block text-sm text-zinc-300">Team name</span><input maxLength={70} minLength={2} value={teamName} onChange={(event) => setTeamName(event.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#ffcf27]" /></label>
        <label className="mt-4 block"><span className="mb-2 block text-sm text-zinc-300">Maximum participants</span><select value={playerLimit} onChange={(event) => setPlayerLimit(event.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#ffcf27]">{Array.from({ length: 30 }, (_, index) => index + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "participant" : "participants"}</option>)}</select><span className="mt-2 block text-xs text-zinc-500">You cannot set the limit below the number of existing paid/reserved places.</span></label>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Paid members" value={`${paidMembers} / ${playerLimit}`} /><Mini label="Fee per person" value={`RM ${depositAmount.toFixed(2)}`} /><Mini label="Status" value={status === "counted" ? "Active" : status === "cancelled" ? "Cancelled" : "Not counted"} /></div>
        {error && <p className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
        {message && <p className="mt-4 rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={saveDetails} disabled={busy || status === "cancelled"} className="rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] disabled:opacity-50">{busy ? "Saving..." : "Save details"}</button><Link href={`/individuals/teams/${teamId}`} className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-800">View public team</Link></div>
      </section>
      {status === "not_counted" && paidMembers === 0 && <section className="rounded-2xl border border-red-900/50 bg-red-950/20 p-5"><h3 className="font-bold text-red-300">Delete unpaid team</h3><p className="mt-2 text-sm leading-6 text-zinc-400">You can delete a team only before anyone pays to join it.</p><button type="button" disabled={busy} onClick={deleteTeam} className="mt-4 rounded-xl border border-red-900 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50">Delete team</button></section>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 font-black">{value}</p></div>; }
