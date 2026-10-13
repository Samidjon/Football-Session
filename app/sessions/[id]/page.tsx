import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Users, CheckCircle2, Clock4 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RegisterTeamForm } from "@/components/register-team-form";
import type { Session, Team } from "@/lib/types";

export default async function SessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: sessionData }, { data: teamsData }, { data: { user } }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("teams").select("*").eq("session_id", id).neq("registration_status", "cancelled").order("created_at", { ascending: true }),
    supabase.auth.getUser()
  ]);
  if (!sessionData) notFound();
  const session = sessionData as Session;
  const teams = (teamsData ?? []) as Team[];
  const perTeamCounts = await Promise.all(teams.map(async (team) => {
    const { count } = await supabase.from("team_memberships").select("id", { count: "exact", head: true }).eq("team_id", team.id).eq("status", "paid");
    return [team.id, count ?? 0] as const;
  }));
  const paidCounts = new Map(perTeamCounts);
  const activeTeamCount = teams.filter((team) => team.registration_status === "confirmed").length;
  const pendingTeamIds = teams.filter((team) => team.registration_status === "pending_payment").map((team) => team.id);
  let reservedPendingTeamCount = 0;
  if (pendingTeamIds.length > 0) {
    const admin = createAdminClient();
    const { data: liveReservations } = await admin.from("team_memberships")
      .select("team_id")
      .in("team_id", pendingTeamIds)
      .eq("status", "pending_payment")
      .gt("expires_at", new Date().toISOString());
    reservedPendingTeamCount = new Set((liveReservations ?? []).map((row) => row.team_id)).size;
  }
  const availableTeamSlots = Math.max(0, session.max_teams - activeTeamCount - reservedPendingTeamCount);
  const mayCreateTeam = !!user && session.status === "open" && availableTeamSlots > 0 && !teams.some((team) => team.created_by === user.id);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href="/sessions" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to sessions</Link>
      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="motion-rise">
          <span className="inline-flex rounded-full bg-[#ffcf27]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ffcf27]">{session.format}</span>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{session.title}</h1>
          {session.description && <p className="mt-3 max-w-2xl leading-7 text-zinc-400">{session.description}</p>}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Info icon={<CalendarDays size={18} />} label="Date" text={formatDate(session.match_date)} />
            <Info icon={<Clock3 size={18} />} label="Time" text={`${session.start_time.slice(0,5)} – ${session.end_time.slice(0,5)}`} />
            <Info icon={<MapPin size={18} />} label="Venue" text={session.venue} />
            <Info icon={<Users size={18} />} label="Player capacity" text={`${session.players_per_team} per team`} />
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffcf27]">Public team board</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Teams in this session</h2><p className="mt-2 text-sm text-zinc-400">Teams are visible immediately; only people who have paid appear in the roster.</p></div><span className="rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-400">{activeTeamCount} / {session.max_teams} teams counted</span></div>
            {teams.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">No teams yet. Start one for this session.</div> : <div className="mt-6 grid gap-4 sm:grid-cols-2">{teams.map((team, index) => { const count = paidCounts.get(team.id) ?? 0; const counted = team.registration_status === "confirmed" || count > 0; return <article key={team.id} className="interactive-card rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5 motion-rise"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-zinc-500">Team {index+1}</p><h3 className="mt-2 break-words text-xl font-black">{team.team_name}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${counted ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{counted ? "Active" : "Not counted"}</span></div><div className="mt-5 flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-zinc-400"><Users size={15} /> {count} / {Number(team.player_limit ?? session.players_per_team)} paid players</span><span className="inline-flex items-center gap-1 text-xs text-zinc-500">{counted ? <CheckCircle2 size={14} /> : <Clock4 size={14} />}{counted ? "Open spots" : "Awaiting payment"}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#ffcf27] transition-all duration-700" style={{width:`${Math.min(100, count / Number(team.player_limit ?? session.players_per_team) * 100)}%`}} /></div><Link href={`/teams/${team.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold transition hover:border-[#ffcf27]/50 hover:bg-[#ffcf27]/5">View team & join</Link></article>})}</div>}
          </section>
        </section>

        <aside className="motion-rise motion-delay-1 lg:sticky lg:top-28">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 interactive-card">
            <p className="text-sm text-zinc-400">Personal registration fee</p><p className="mt-1 text-4xl font-black text-[#ffcf27]">RM {Number(session.deposit_amount).toFixed(2)}<span className="ml-2 text-sm font-semibold text-zinc-500">/ person</span></p>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-xs text-zinc-500">Teams counted</p><p className="mt-1 text-xl font-black">{activeTeamCount}/{session.max_teams}</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-xs text-zinc-500">Team slots left</p><p className="mt-1 text-xl font-black">{availableTeamSlots}</p></div></div>
            <p className="mt-5 text-sm leading-6 text-zinc-400">Create a team for free. Every person pays their own fee to join, and their name appears only after payment succeeds.</p>
            <div className="mt-6">{mayCreateTeam ? <RegisterTeamForm sessionId={session.id} maxPlayers={session.players_per_team} /> : !user ? <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5"><p className="text-sm leading-6 text-zinc-400">Sign in to create a team or pay for your own place in an existing team.</p><Link href="/auth/login" className="mt-4 inline-flex w-full justify-center rounded-xl bg-[#ffcf27] px-4 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477]">Sign in</Link></div> : teams.some((team) => team.created_by === user.id) ? <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-400">You have already created a team in this session. Open your team card to join it or share it with others.</div> : <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-400">No new team slots are available. You can still join an existing team with open places.</div>}</div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Info({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm"><span className="text-[#ffcf27]">{icon}</span><span className="min-w-0"><span className="block text-xs text-zinc-500">{label}</span><span className="mt-1 block break-words font-semibold text-zinc-200">{text}</span></span></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
