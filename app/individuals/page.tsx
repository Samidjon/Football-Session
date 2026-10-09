import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function IndividualsPage() {
  const supabase = await createClient();
  const [{ data: teams }, { data: settings }] = await Promise.all([
    supabase.from("individual_teams").select("id, team_name, status, deposit_amount, created_at").neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("individual_settings").select("deposit_amount").eq("id", 1).maybeSingle()
  ]);

  const teamList = teams ?? [];
  const activeCount = teamList.filter((team) => team.status === "counted").length;
  const notCountedCount = teamList.filter((team) => team.status === "not_counted").length;
  const deposit = Number(settings?.deposit_amount ?? 50);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 md:p-10">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · INDIVIDUALS</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Build your squad.<br /><span className="text-[#ffcf27]">Get counted.</span></h1>
            <p className="mt-5 max-w-2xl leading-7 text-zinc-400">A public team directory for captains who want to build a larger squad. Create a team, add up to 30 players, and pay the deposit whenever you’re ready. Unpaid teams stay visible but are marked Not counted.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/individuals/new" className="inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] hover:bg-[#ffe477]">Create a team <ArrowRight size={18} /></Link>
              <Link href="/sessions" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-800">Browse sessions</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:min-w-64 md:grid-cols-1">
            <Stat label="Counted teams" value={activeCount} tone="active" />
            <Stat label="Not counted yet" value={notCountedCount} tone="pending" />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-4 border-t border-zinc-800 pt-5 text-sm text-zinc-400">
          <span className="inline-flex items-center gap-2"><Users size={16} /> Up to 30 players per team</span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} /> Deposit: RM {deposit.toFixed(2)}</span>
          <span className="inline-flex items-center gap-2"><Clock3 size={16} /> Pay later, get counted after success</span>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-black md:text-3xl">Public teams</h2><p className="mt-2 text-zinc-400">Anyone can view teams and their player lists without logging in.</p></div>
          <span className="text-sm text-zinc-500">{teamList.length} teams listed</span>
        </div>
        {teamList.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-10 text-center"><p className="text-lg font-semibold">No individual teams yet</p><p className="mt-2 text-zinc-500">Be the first captain to create a public squad.</p></div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {teamList.map((team) => <Link key={team.id} href={`/individuals/teams/${team.id}`} className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 transition hover:border-[#ffcf27]/50 hover:bg-zinc-900">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Individual team</p><h3 className="mt-2 text-2xl font-black">{team.team_name}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${team.status === "counted" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>{team.status === "counted" ? "Counted" : "Not counted"}</span></div>
              <p className="mt-5 text-sm text-zinc-400">{team.status === "counted" ? "Deposit paid · Active team" : "Deposit pending · Not included in active count"}</p>
              <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4 text-sm"><span className="text-zinc-500">Deposit · RM {Number(team.deposit_amount).toFixed(2)}</span><span className="inline-flex items-center gap-2 font-semibold text-[#ffcf27]">View squad <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></div>
            </Link>)}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "active" | "pending" }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-500">{label}</p><p className={`mt-2 text-3xl font-black ${tone === "active" ? "text-emerald-400" : "text-amber-300"}`}>{value}</p></div>;
}
