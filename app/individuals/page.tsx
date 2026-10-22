"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDollarSign, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CreateIndividualTeamForm } from "@/components/create-individual-team-form";

type IndividualTeam = {
  id: string;
  captain_id: string;
  team_name: string;
  deposit_amount: number;
  status: "not_counted" | "counted" | "cancelled";
  player_limit: number;
  created_at: string;
};

export default function IndividualsPage() {
  const [teams, setTeams] = useState<IndividualTeam[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [fee, setFee] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const [{ data: auth }, { data: settings }, { data: teamData, error: teamError }, { data: memberships }, { data: legacyPlayers }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("individual_settings").select("deposit_amount").eq("id", 1).maybeSingle(),
        supabase.from("individual_teams").select("id,captain_id,team_name,deposit_amount,status,player_limit,created_at").neq("status", "cancelled").order("created_at", { ascending: false }),
        supabase.from("individual_team_memberships").select("individual_team_id").eq("status", "paid"),
        supabase.from("individual_players").select("individual_team_id"),
      ]);
      if (!active) return;
      if (teamError) {
        setLoadError("Could not load teams. Please refresh the page in a moment.");
        setLoading(false);
        return;
      }
      const rows = (teamData ?? []) as IndividualTeam[];
      const membershipCounts: Record<string, number> = {};
      const legacyCounts: Record<string, number> = {};
      for (const row of memberships ?? []) membershipCounts[row.individual_team_id] = (membershipCounts[row.individual_team_id] ?? 0) + 1;
      for (const row of legacyPlayers ?? []) legacyCounts[row.individual_team_id] = (legacyCounts[row.individual_team_id] ?? 0) + 1;
      const nextCounts: Record<string, number> = {};
      for (const team of rows) nextCounts[team.id] = membershipCounts[team.id] || legacyCounts[team.id] || 0;
      setTeams(rows);
      setCounts(nextCounts);
      setFee(settings?.deposit_amount == null ? null : Number(settings.deposit_amount));
      setUserId(auth.user?.id ?? null);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-7 md:p-10">
        <div className="pointer-events-none absolute -right-8 -top-12 h-56 w-56 rounded-full border-[26px] border-[#ffcf27]/10" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · INDIVIDUALS</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Need a squad?<br /><span className="text-[#ffcf27]">Start one here.</span></h1>
            <p className="mt-5 max-w-2xl leading-7 text-zinc-300">Create a public team, share it with friends or open players, and let everyone reserve and pay for their own place. You don’t need a full squad to get started.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#create-team" className="inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477]">Create an individual team <ArrowRight size={18} /></a>
              <Link href="/teams" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800">Have a team code?</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-500">Public teams</p><p className="mt-2 text-3xl font-black text-white">{teams.length}</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-500">Per player</p><p className="mt-2 text-3xl font-black text-[#ffcf27]">{fee == null ? "—" : `RM ${fee.toFixed(2)}`}</p></div>
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-4 border-t border-white/10 pt-5 text-sm text-zinc-300">
          <span className="inline-flex items-center gap-2"><Users size={16} /> Open to new players</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Secure individual checkout</span>
          <span className="inline-flex items-center gap-2"><CircleDollarSign size={16} /> Pay for your own place</span>
        </div>
      </section>

      <section id="create-team" className="mt-8 scroll-mt-28">
        {!userId ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/65 p-6 sm:p-8">
            <h2 className="text-2xl font-black">Create a team</h2>
            <p className="mt-2 text-zinc-400">Sign in first, then create a team for other players to join.</p>
            <Link href="/auth/login?next=/individuals" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Sign in to continue <ArrowRight size={17} /></Link>
          </div>
        ) : (
          <CreateIndividualTeamForm depositAmount={fee ?? 50} />
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Open roster</p><h2 className="mt-2 text-2xl font-black md:text-3xl">Teams looking for players</h2><p className="mt-2 text-zinc-400">Choose a team to see its roster, places left and individual fee.</p></div>
          <span className="text-sm text-zinc-500">{teams.length} available</span>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-zinc-800 p-8 text-center text-zinc-400">Loading teams…</div>
        ) : loadError ? (
          <div role="alert" className="mt-6 rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-300">{loadError}</div>
        ) : teams.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffcf27]/10 text-[#ffcf27]"><Users size={24} /></div><h3 className="mt-4 text-lg font-bold">No individual teams yet</h3><p className="mt-2 text-sm text-zinc-500">Start one above. Your new team will appear here for others to join.</p></div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 motm-stagger">
            {teams.map((team, index) => {
              const count = counts[team.id] ?? 0;
              const capacity = Number(team.player_limit || 30);
              const full = count >= capacity;
              return (
                <article key={team.id} className="interactive-card flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5 motion-rise">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Open team · {String(index + 1).padStart(2, "0")}</p><h3 className="mt-2 break-words text-xl font-black">{team.team_name}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${full ? "bg-zinc-800 text-zinc-400" : "bg-emerald-500/10 text-emerald-300"}`}>{full ? "Full" : "Recruiting"}</span></div>
                  <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-xs text-zinc-500">Places filled</p><p className="mt-1 text-lg font-black">{count} / {capacity}</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-xs text-zinc-500">Per player</p><p className="mt-1 text-lg font-black text-[#ffcf27]">RM {Number(team.deposit_amount).toFixed(2)}</p></div></div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#ffcf27] transition-all" style={{ width: `${Math.min(100, (count / Math.max(capacity, 1)) * 100)}%` }} /></div>
                  <Link href={`/individuals/teams/${team.id}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold transition hover:border-[#ffcf27]/50 hover:bg-[#ffcf27]/5">{full ? "View team" : "View team & join"} <ArrowRight size={16} /></Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="mt-10 text-center text-xs leading-5 text-zinc-500"><CheckCircle2 className="mr-1 inline-block align-text-bottom text-emerald-400" size={14} /> Only successful individual payments are included in the registered player count.</p>
    </main>
  );
}
