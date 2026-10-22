import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function IndividualTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: team }, { data: { user } }] = await Promise.all([
    supabase.from("individual_teams").select("id,captain_id,team_name,deposit_amount,status,player_limit,created_at").eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!team || team.status === "cancelled") notFound();

  const [{ data: members }, { data: legacyPlayers }, { data: ownMembership }] = await Promise.all([
    supabase.from("individual_team_memberships").select("id,player_name,paid_at").eq("individual_team_id", id).eq("status", "paid").order("paid_at", { ascending: true }),
    supabase.from("individual_players").select("id,player_name,created_at").eq("individual_team_id", id).order("created_at", { ascending: true }),
    user ? supabase.from("individual_team_memberships").select("id,status,expires_at").eq("individual_team_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const players = (members?.length ? members : legacyPlayers ?? []);
  const capacity = Number(team.player_limit || 30);
  const placesLeft = Math.max(0, capacity - players.length);
  const isCaptain = user?.id === team.captain_id;
  const alreadyJoined = ownMembership?.status === "paid";

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href="/individuals" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to Individuals</Link>
      <section className="relative mt-7 overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-8 -top-10 h-52 w-52 rounded-full border-[24px] border-[#ffcf27]/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ffcf27]">MOTM · Individuals</p><h1 className="mt-3 break-words text-4xl font-black tracking-tight sm:text-5xl">{team.team_name}</h1><p className="mt-3 text-zinc-400">An open squad with individual registration.</p></div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${team.status === "counted" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{team.status === "counted" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}{team.status === "counted" ? "Active team" : "Recruiting players"}</span>
        </div>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
          <Info icon={<Users size={17} />} label="Registered players" value={`${players.length} / ${capacity}`} />
          <Info icon={<CalendarCheck size={17} />} label="Spots left" value={String(placesLeft)} />
          <Info icon={<ShieldCheck size={17} />} label="Individual fee" value={`RM ${Number(team.deposit_amount).toFixed(2)} / person`} />
        </div>
        <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#ffcf27] transition-all duration-700" style={{ width: `${Math.min(100, players.length / Math.max(capacity, 1) * 100)}%` }} /></div>
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          {isCaptain && <span className="rounded-xl border border-[#ffcf27]/30 px-4 py-3 text-sm font-bold text-[#ffcf27]">You created this team</span>}
          {alreadyJoined ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300"><CheckCircle2 size={16} /> You are registered</span>
          ) : !user ? (
            <Link href={`/auth/login?next=/individuals/${id}`} className="rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522] transition hover:bg-[#ffe477]">Sign in to join</Link>
          ) : placesLeft <= 0 ? (
            <span className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-400">Team full</span>
          ) : (
            <Link href={`/individuals/${id}/payment`} className="rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522] transition hover:bg-[#ffe477]">{ownMembership?.status === "pending_payment" ? "Continue payment" : `Join and pay · RM ${Number(team.deposit_amount).toFixed(2)}`}</Link>
          )}
          <Link href="/individuals" className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition hover:bg-zinc-800">Explore other teams</Link>
        </div>
        <p className="relative mt-4 text-xs leading-5 text-zinc-500">Your name is shown in this roster only after your own payment is confirmed.</p>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Public roster</p><h2 className="mt-2 text-2xl font-black">Team members</h2></div><span className="rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-400">{players.length} registered · {placesLeft} places left</span></div>
        {players.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-9 text-center"><Users size={26} className="mx-auto text-[#ffcf27]" /><h3 className="mt-4 text-lg font-bold">Be the first to join</h3><p className="mt-2 text-sm text-zinc-500">This team is open for registrations. Players will show here after their payments succeed.</p></div> : <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((player, index) => <article key={player.id} className="interactive-card flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/65 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffcf27]/10 text-sm font-black text-[#ffcf27]">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0"><span className="block truncate font-bold">{player.player_name}</span><span className="mt-1 block text-xs text-emerald-400">Registered player</span></span></article>)}</div>}
      </section>
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-[#ffcf27]">{icon}<span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span></div><p className="mt-2 break-words text-sm font-semibold text-white">{value}</p></div>;
}
