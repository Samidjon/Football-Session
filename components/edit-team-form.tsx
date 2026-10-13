"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditTeamForm({ teamId, initialTeamName }: { teamId: string; initialTeamName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState(initialTeamName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function saveTeam() {
    const name = teamName.trim();
    if (name.length < 2 || name.length > 70) return setError("Team name must be between 2 and 70 characters.");
    setLoading(true); setError("");
    const { error } = await supabase.from("teams").update({ team_name: name }).eq("id", teamId);
    if (error) { setError(error.message); setLoading(false); return; }
    setLoading(false); router.push(`/teams/${teamId}`); router.refresh();
  }

  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 interactive-card"><h2 className="text-xl font-black">Team details</h2><p className="mt-2 text-sm text-zinc-400">Change the team name. The public player list is made up of individual paid registrations.</p><label className="mt-5 block"><span className="mb-2 block text-sm text-zinc-300">Team name</span><input value={teamName} onChange={(event)=>setTeamName(event.target.value)} maxLength={70} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none transition focus:border-[#ffcf27]" /></label>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}<button onClick={saveTeam} disabled={loading} className="mt-4 rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522] transition hover:-translate-y-0.5 hover:bg-[#ffe477] disabled:opacity-50">{loading ? "Saving..." : "Save team name"}</button></section>;
}
