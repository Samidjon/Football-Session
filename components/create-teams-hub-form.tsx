"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, KeyRound, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SessionOption = {
  id: string;
  title: string;
  match_date: string;
  venue: string;
  players_per_team: number;
  status: string;
};

export function CreateTeamsHubForm({ sessions, isSignedIn }: { sessions: SessionOption[]; isSignedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const selectedSession = sessions.find((session) => session.id === sessionId);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [playerLimit, setPlayerLimit] = useState(String(sessions[0]?.players_per_team ?? 12));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeSession(nextId: string) {
    setSessionId(nextId);
    const nextSession = sessions.find((session) => session.id === nextId);
    setPlayerLimit(String(nextSession?.players_per_team ?? 12));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSignedIn) {
      router.push("/auth/login?next=/teams");
      return;
    }
    const normalizedCode = inviteCode.trim().toUpperCase();
    const normalizedName = teamName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 70) {
      setError("Team name must be between 2 and 70 characters.");
      return;
    }
    if (!sessionId) {
      setError("Choose a session for this team.");
      return;
    }
    if (!/^[A-Z0-9-]{4,12}$/.test(normalizedCode)) {
      setError("Room code must contain 4–12 letters, numbers, or hyphens.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: createError } = await supabase.rpc("register_team", {
      p_session_id: sessionId,
      p_team_name: normalizedName,
      p_player_limit: Number(playerLimit),
      p_invite_code: normalizedCode,
      p_creation_source: "teams",
    });
    if (createError || !data) {
      setError(createError?.message ?? "Could not create the team. Please try again.");
      setLoading(false);
      return;
    }
    router.push(`/teams/${data}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8 interactive-card">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ffcf27]/10 text-[#ffcf27]"><Plus size={24} /></span>
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Captain’s corner</p><h2 className="mt-1 text-2xl font-black">Create a team</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Choose the session your squad is playing in and set a private room code. Your team will appear in the Teams directory and on that session’s team board.</p></div>
      </div>
      {!isSignedIn && <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">Sign in is required to create a team. <Link href="/auth/login?next=/teams" className="ml-1 font-bold text-[#ffcf27] underline underline-offset-4">Sign in to continue</Link></div>}
      {sessions.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">There are no open sessions to attach a team to yet. Please check back when a session is published.</div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-semibold text-zinc-300">Session</span><select value={sessionId} onChange={(event) => changeSession(event.target.value)} required className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-[#ffcf27]">{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {new Date(`${session.match_date}T00:00:00`).toLocaleDateString("en-MY")} · {session.venue}</option>)}</select></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-zinc-300">Team name</span><input required minLength={2} maxLength={70} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="e.g. KL Night Owls" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-[#ffcf27]" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-zinc-300">Team capacity</span><select required value={playerLimit} onChange={(event) => setPlayerLimit(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-[#ffcf27]">{Array.from({ length: Math.max(1, selectedSession?.players_per_team ?? 12) }, (_, i) => i + 1).map((size) => <option key={size} value={size}>{size} {size === 1 ? "player" : "players"}</option>)}</select></label>
            <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-semibold text-zinc-300">Private room code</span><span className="relative block"><KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} /><input required minLength={4} maxLength={12} pattern="[A-Za-z0-9-]{4,12}" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12))} placeholder="e.g. BLUE-26" autoComplete="off" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 font-bold tracking-wider outline-none transition focus:border-[#ffcf27]" /></span><span className="mt-2 block text-xs text-zinc-500">Keep this code for your team. Players must enter it before they can join and pay.</span></label>
          </div>
          {selectedSession && <p className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-500"><CalendarDays size={14} /> {selectedSession.venue} · up to {selectedSession.players_per_team} players per team</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={loading || !isSignedIn} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522] transition hover:bg-[#ffe477] disabled:opacity-50">{loading ? "Creating team…" : "Create team"} <Users size={17} /></button>
        </>
      )}
    </form>
  );
}
