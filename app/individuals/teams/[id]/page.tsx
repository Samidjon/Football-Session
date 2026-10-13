import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function IndividualTeamPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: team }, { data: players }, { data: { user } }] = await Promise.all([
    supabase.from("individual_teams").select("id, team_name, captain_id, status, deposit_amount, player_limit, created_at").eq("id", id).maybeSingle(),
    supabase.from("individual_team_memberships").select("id, player_name, paid_at").eq("individual_team_id", id).eq("status", "paid").order("paid_at", { ascending: true }),
    supabase.auth.getUser()
  ]);
  if (!team || team.status === "cancelled") notFound();
  const isCreator = user?.id === team.captain_id;
  const { data: ownMembership } = user ? await supabase.from("individual_team_memberships").select("id, status").eq("individual_team_id", id).eq("user_id", user.id).maybeSingle() : { data: null };
  const members = players ?? [];
  const capacity = Number(team.player_limit ?? 30);
  const full = members.length >= capacity;
  const joined = ownMembership?.status === "paid";

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter">
      <Link href="/individuals" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> All individual teams</Link>
      <section className="relative mt-7 overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-7 md:p-9 interactive-card">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full border-[24px] border-[#ffcf27]/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Public squad</p><h1 className="mt-2 text-4xl font-black md:text-5xl">{team.team_name}</h1><p className="mt-3 text-zinc-300">MOTM Individuals · {capacity} places</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${team.status === "counted" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{team.status === "counted" ? "Active · members paid" : "Not counted · waiting for first payment"}</span></div>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3"><Stat label="Paid participants" value={`${members.length} / ${capacity}`} /><Stat label="Fee per person" value={`RM ${Number(team.deposit_amount).toFixed(2)}`} /><Stat label="Available places" value={String(Math.max(0, capacity - members.length))} /></div>
        <div className="relative mt-7 flex flex-wrap gap-3">
          {isCreator && <Link href={`/individuals/teams/${id}/manage`} className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold transition hover:bg-white/10">Manage team</Link>}
          {joined ? <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-5 py-3 font-bold text-emerald-300"><CheckCircle2 size={17} /> You are a member</span> : !user ? <Link href={`/auth/login?next=/individuals/teams/${id}/payment`} className="motm-button-pop rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522]">Sign in to join</Link> : full ? <span className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-zinc-400">Team is full</span> : <Link href={`/individuals/teams/${id}/payment`} className="motm-button-pop rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522]">{ownMembership?.status === "pending_payment" ? "Continue payment" : `Join and pay · RM ${Number(team.deposit_amount).toFixed(2)}`}</Link>}
        </div>
        {team.status !== "counted" && <p className="relative mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100">This team is visible to everyone, but a participant only becomes a member after their own payment succeeds. Creating the team is free.</p>}
      </section>
      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffcf27]">Public roster</p><h2 className="mt-2 text-2xl font-black">Team members</h2><p className="mt-2 text-sm text-zinc-400">Only people who paid are visible here.</p></div><span className="inline-flex items-center gap-2 text-sm text-zinc-500"><Users size={16} /> {members.length} paid</span></div>
        {!members.length ? <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-9 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffcf27]/10 text-[#ffcf27]"><Users size={23} /></div><p className="mt-4 font-semibold">No members yet</p><p className="mt-2 text-sm text-zinc-500">Be the first to join and pay for your place.</p></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{members.map((player, index) => <article key={player.id} className="interactive-card motion-rise flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffcf27]/10 text-sm font-bold text-[#ffcf27]">{String(index + 1).padStart(2, "0")}</span><span className="font-semibold">{player.player_name}</span><ShieldCheck size={16} className="ml-auto text-emerald-500" /></article>)}</div>}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></div>; }
