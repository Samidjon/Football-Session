import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function TeamSquadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("id, team_name, session_id").eq("id", id).maybeSingle();
  if (!team) notFound();
  const { data: players } = await supabase.from("team_memberships").select("id, player_name, paid_at").eq("team_id", id).eq("status", "paid").order("paid_at", { ascending: true });
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href={`/sessions/${team.session_id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to session</Link>
      <section className="mt-7 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-9 motion-rise">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · Public roster</p>
        <h1 className="mt-3 text-4xl font-black">{team.team_name}</h1>
        <p className="mt-2 text-zinc-400">{players?.length ?? 0} paid players</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">{(players ?? []).map((player,index)=><div key={player.id} className="interactive-card flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffcf27]/10 font-black text-[#ffcf27]">{index+1}</span><span className="font-semibold">{player.player_name}</span><span className="ml-auto text-xs font-bold text-emerald-400">PAID</span></div>)}</div>
        {(!players || players.length===0) && <p className="mt-7 rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">No paid players yet. Names become visible after each person pays.</p>}
        <Link href={`/teams/${id}`} className="mt-7 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Team details</Link>
      </section>
    </main>
  );
}
