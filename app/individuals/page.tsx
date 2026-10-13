import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function IndividualsPage() {
  const supabase = await createClient();
  const [{ data: teams }, { data: settings }] = await Promise.all([
    supabase.from("individual_teams").select("id, team_name, status, deposit_amount, player_limit, created_at").neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("individual_settings").select("deposit_amount").eq("id", 1).maybeSingle()
  ]);

  const teamList = teams ?? [];
  const memberCounts = await Promise.all(teamList.map(async (team) => {
    const { count } = await supabase.from("individual_team_memberships").select("id", { count: "exact", head: true }).eq("individual_team_id", team.id).eq("status", "paid");
    return [team.id, count ?? 0] as const;
  }));
  const counts = new Map(memberCounts);
  const activeCount = teamList.filter((team) => team.status === "counted").length;
  const notCountedCount = teamList.filter((team) => team.status === "not_counted").length;
  const fee = Number(settings?.deposit_amount ?? 50);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-7 md:p-10 motm-hero-glow">
        <div className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full border-[26px] border-[#ffcf27]/10" />
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · INDIVIDUALS</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Find your squad.<br /><span className="text-[#ffcf27]">Join and play.</span></h1>
            <p className="mt-5 max-w-2xl leading-7 text-zinc-300">Create a public team for free, or join an existing one. Every participant pays their own fee. Your name appears in the roster after payment succeeds.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/individuals/new" className="motm-button-pop inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Create a team — free <ArrowRight size={18} /></Link>
              <Link href="/sessions" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800">Browse sessions</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:min-w-64 md:grid-cols-1">
            <Stat label="Active teams" value={activeCount} tone="active" />
            <Stat label="Awaiting first payment" value={notCountedCount} tone="pending" />
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-4 border-t border-white/10 pt-5 text-sm text-zinc-300">
          <span className="inline-flex items-center gap-2"><Users size={16} /> Up to 30 people per team</span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} /> RM {fee.toFixed(2)} per person</span>
          <span className="inline-flex items-center gap-2"><Clock3 size={16} /> Create free · Pay to join</span>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black md:text-3xl">Public teams</h2><p className="mt-2 text-zinc-400">Anyone can view team names and paid participant rosters without an account.</p></div><span className="text-sm text-zinc-500">{teamList.length} teams</span></div>
        {!teamList.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-10 text-center"><p className="text-lg font-semibold">No teams yet</p><p className="mt-2 text-zinc-500">Create the first team for free.</p></div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3 motm-stagger">
            {teamList.map((team) => {
              const count = counts.get(team.id) ?? 0;
              return <Link key={team.id} href={`/individuals/teams/${team.id}`} className="interactive-card motion-rise group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Individual team</p><h3 className="mt-2 text-2xl font-black">{team.team_name}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${team.status === "counted" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>{team.status === "counted" ? "Active" : "Not counted"}</span></div>
                <p className="mt-5 text-sm text-zinc-400">{count} / {team.player_limit ?? 30} paid participants</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#ffcf27] transition-all duration-700" style={{ width: `${Math.min(100, count / Number(team.player_limit ?? 30) * 100)}%` }} /></div>
                <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4 text-sm"><span className="text-zinc-500">RM {Number(team.deposit_amount).toFixed(2)} / person</span><span className="inline-flex items-center gap-2 font-bold text-[#ffcf27]">View & join <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></div>
              </Link>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "active" | "pending" }) {
  return <div className="interactive-card rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-500">{label}</p><p className={`mt-2 text-3xl font-black ${tone === "active" ? "text-emerald-400" : "text-amber-300"}`}>{value}</p></div>;
}
