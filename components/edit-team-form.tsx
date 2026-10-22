"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditTeamForm({ teamId, initialTeamName, initialInviteCode }: { teamId: string; initialTeamName: string; initialInviteCode: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState(initialTeamName);
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function saveTeam() {
    const name = teamName.trim();
    const code = inviteCode.trim().toUpperCase();
    if (name.length < 2 || name.length > 70) return setError("Team name must be between 2 and 70 characters.");
    if (!/^[A-Z0-9-]{4,12}$/.test(code)) return setError("Join code must contain 4–12 letters, numbers or hyphens.");
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.rpc("update_session_team_details", {
      p_team_id: teamId,
      p_team_name: name,
      p_invite_code: code,
    });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push(`/teams/${teamId}`);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 interactive-card">
      <h2 className="text-xl font-black">Team details</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Update your team name or change the private join code. Share the code only with players you want to invite.</p>
      <label className="mt-5 block"><span className="mb-2 block text-sm text-zinc-300">Team name</span><input value={teamName} onChange={(event) => setTeamName(event.target.value)} minLength={2} maxLength={70} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none transition focus:border-[#ffcf27]" /></label>
      <label className="mt-4 block"><span className="mb-2 block text-sm text-zinc-300">Private join code</span><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12))} minLength={4} maxLength={12} pattern="[A-Z0-9-]{4,12}" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-bold tracking-wider outline-none transition focus:border-[#ffcf27]" /></label>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <button onClick={saveTeam} disabled={loading} className="mt-4 rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522] transition hover:-translate-y-0.5 hover:bg-[#ffe477] disabled:opacity-50">{loading ? "Saving..." : "Save team & code"}</button>
    </section>
  );
}
