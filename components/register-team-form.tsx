"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function RegisterTeamForm({ sessionId, maxPlayers }: { sessionId: string; maxPlayers: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [playerLimit, setPlayerLimit] = useState(String(maxPlayers));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedCode = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,12}$/.test(normalizedCode)) {
      setError("Choose a join code with 4–12 letters, numbers or hyphens.");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc("register_team", {
      p_session_id: sessionId,
      p_team_name: teamName.trim(),
      p_player_limit: Number(playerLimit),
      p_invite_code: normalizedCode,
    });

    if (error || !data) {
      setError(error?.message ?? "Could not create the team. Please try again.");
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
      <p className="mt-2 text-sm leading-6 text-zinc-400">Create your team for this session and set a private join code. Players use the code on the Teams page to find the squad, then reserve their own place.</p>

      <label className="mt-5 block"><span className="mb-2 block text-sm text-zinc-300">Team name</span><input required minLength={2} maxLength={70} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="MOTM United" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#ffcf27]" /></label>

      <label className="mt-4 block"><span className="mb-2 block text-sm text-zinc-300">Private join code</span><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} /><input required minLength={4} maxLength={12} pattern="[A-Za-z0-9-]{4,12}" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12))} placeholder="e.g. MOTM-26" autoComplete="off" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 font-bold tracking-wider outline-none focus:border-[#ffcf27]" /></div><span className="mt-2 block text-xs text-zinc-500">Use 4–12 letters, numbers or hyphens. The code must be unique.</span></label>

      <label className="mt-4 block"><span className="mb-2 block text-sm text-zinc-300">Number of players</span><select required value={playerLimit} onChange={(e) => setPlayerLimit(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#ffcf27]">{Array.from({ length: maxPlayers }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number} {number === 1 ? "player" : "players"}</option>)}</select><span className="mt-2 block text-xs text-zinc-500">You can choose up to {maxPlayers}, as allowed by this session.</span></label>

      {error && <div role="alert" className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>}
      <button disabled={loading} className="mt-5 w-full rounded-xl bg-[#ffcf27] px-4 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477] disabled:opacity-50">{loading ? "Creating team..." : "Create team — free"}</button>
    </form>
  );
}
