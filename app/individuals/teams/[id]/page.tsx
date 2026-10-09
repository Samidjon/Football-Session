import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function IndividualTeamPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: team }, { data: players }, { data: { user } }] = await Promise.all([
    supabase.from("individual_teams").select("id, team_name, captain_id, status, deposit_amount, created_at").eq("id", id).maybeSingle(),
    supabase.from("individual_players").select("id, player_name").eq("individual_team_id", id).order("created_at", { ascending: true }),
    supabase.auth.getUser()
  ]);
  if (!team || team.status === "cancelled") notFound();
  const isCaptain = user?.id === team.captain_id;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href="/individuals" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> All individual teams</Link>
      <section className="mt-7 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Public squad</p><h1 className="mt-2 text-4xl font-black md:text-5xl">{team.team_name}</h1><p className="mt-3 text-zinc-400">MOTM Individuals · Up to 30 players</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${team.status === "counted" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>{team.status === "counted" ? "Counted · Deposit paid" : "Not counted · Deposit pending"}</span></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-500">Squad size</p><p className="mt-1 text-2xl font-black">{players?.length ?? 0} / 30</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-500">Deposit</p><p className="mt-1 text-2xl font-black">RM {Number(team.deposit_amount).toFixed(2)}</p></div></div>
        <div className="mt-8 flex flex-wrap gap-3">{isCaptain && <Link href={`/individuals/teams/${id}/manage`} className="rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] hover:bg-[#ffe477]">Manage squad</Link>}{isCaptain && team.status === "not_counted" && <Link href={`/individuals/teams/${id}/payment`} className="rounded-xl border border-[#1559ad] px-5 py-3 font-semibold text-white hover:bg-[#1559ad]/20">Pay deposit now</Link>}</div>
        {team.status === "not_counted" && <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">This team is publicly visible but is not included in the counted teams total until the deposit has been successfully paid.</p>}
      </section>
      <section className="mt-8"><div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Squad members</h2><p className="mt-1 text-sm text-zinc-400">Visible to everyone, including visitors without an account.</p></div><span className="inline-flex items-center gap-2 text-sm text-zinc-500"><Users size={16} /> {players?.length ?? 0} players</span></div>
        {!players?.length ? <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">No players have been added yet.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{players.map((player, index) => <div key={player.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffcf27]/10 text-sm font-bold text-[#ffcf27]">{index + 1}</span><span className="font-medium">{player.player_name}</span><ShieldCheck className="ml-auto text-zinc-600" size={16} /></div>)}</div>}
      </section>
    </main>
  );
}
