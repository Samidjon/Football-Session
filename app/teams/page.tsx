import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { CreateTeamsHubForm } from "@/components/create-teams-hub-form";
import { createClient } from "@/lib/supabase/server";

type SessionInfo = {
  id: string;
  title: string;
  match_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  players_per_team: number;
  deposit_amount: number;
  status: string;
};

type TeamInfo = {
  id: string;
  team_name: string;
  registration_status: string;
  player_limit: number;
  created_at: string;
  session_id: string;
  sessions: SessionInfo | SessionInfo[] | null;
};

export default async function TeamsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: sessionsData }, { data: teamData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("sessions").select("id,title,match_date,start_time,end_time,venue,players_per_team,deposit_amount,status")
      .in("status", ["open", "full"]).order("match_date", { ascending: true }).order("start_time", { ascending: true }),
    supabase.from("teams")
      .select("id,team_name,registration_status,player_limit,created_at,session_id,sessions(id,title,match_date,start_time,end_time,venue,players_per_team,deposit_amount,status)")
      .eq("creation_source", "teams")
      .neq("registration_status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  const sessions = (sessionsData ?? []) as SessionInfo[];
  const teams = (teamData ?? []) as TeamInfo[];
  const countRows = await Promise.all(teams.map(async (team) => {
    const [{ count: paidCount }, { count: reservedCount }] = await Promise.all([
      supabase.from("team_memberships").select("id", { count: "exact", head: true })
        .eq("team_id", team.id).eq("status", "paid"),
      supabase.from("team_memberships").select("id", { count: "exact", head: true })
        .eq("team_id", team.id).eq("status", "pending_payment").gt("expires_at", new Date().toISOString()),
    ]);
    return [team.id, { paid: paidCount ?? 0, reserved: reservedCount ?? 0 }] as const;
  }));
  const counts = new Map(countRows);
  const totalPaid = countRows.reduce((sum, [, row]) => sum + row.paid, 0);
  const recruiting = teams.filter((team) => {
    const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;
    const count = counts.get(team.id);
    return !!session && ["open", "full"].includes(session.status) && (count?.paid ?? 0) + (count?.reserved ?? 0) < Number(team.player_limit || session.players_per_team);
  }).length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-7 md:p-10 motm-hero-glow">
        <div className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full border-[26px] border-[#ffcf27]/10" />
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · TEAMS</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Your team.<br /><span className="text-[#ffcf27]">Your room code.</span></h1>
            <p className="mt-5 max-w-2xl leading-7 text-zinc-300">Create a squad for a football session, share its private room code with the players you want, and manage the roster in one place. Teams created here also appear on their session page.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#create-team" className="inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477]">Create a team <ArrowRight size={18} /></a>
              <Link href="/sessions" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800">Browse sessions</Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:min-w-72">
            <Stat label="Teams" value={teams.length} />
            <Stat label="Recruiting" value={recruiting} />
            <Stat label="Paid players" value={totalPaid} />
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-4 border-t border-white/10 pt-5 text-sm text-zinc-300">
          <span className="inline-flex items-center gap-2"><KeyRoundIcon /> Invite-only joining</span>
          <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> Session-linked teams</span>
          <span className="inline-flex items-center gap-2"><Users size={16} /> Paid roster tracking</span>
        </div>
      </section>

      <section id="create-team" className="mt-8 scroll-mt-28">
        <CreateTeamsHubForm sessions={sessions} isSignedIn={!!user} />
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Teams directory</p>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Teams created in Teams</h2>
            <p className="mt-2 max-w-2xl text-zinc-400">Open View Team to see the roster and session details. Players must enter their room code before they can join and pay.</p>
          </div>
          <span className="text-sm text-zinc-500">{teams.length} {teams.length === 1 ? "team" : "teams"}</span>
        </div>

        {teams.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffcf27]/10 text-[#ffcf27]"><Users size={24} /></div>
            <h3 className="mt-4 text-lg font-bold">No Teams created yet</h3>
            <p className="mt-2 text-sm text-zinc-500">Create the first team above. It will appear here and on the selected football session.</p>
            <a href="#create-team" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Create first team <ArrowRight size={17} /></a>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 motm-stagger">
            {teams.map((team, index) => {
              const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;
              const count = counts.get(team.id) ?? { paid: 0, reserved: 0 };
              const cap = Number(team.player_limit || session?.players_per_team || 12);
              const full = count.paid + count.reserved >= cap;
              return (
                <article key={team.id} className="interactive-card flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5 motion-rise">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Team · {String(index + 1).padStart(2, "0")}</p><h3 className="mt-2 break-words text-xl font-black">{team.team_name}</h3></div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${full ? "bg-zinc-800 text-zinc-400" : "bg-emerald-500/10 text-emerald-300"}`}>{full ? "Full" : "Recruiting"}</span>
                  </div>
                  {session && <div className="mt-5 space-y-2 text-sm text-zinc-400"><p className="flex items-start gap-2"><CalendarDays size={15} className="mt-0.5 shrink-0 text-[#ffcf27]" />{formatDate(session.match_date)} · {session.start_time.slice(0,5)}–{session.end_time.slice(0,5)}</p><p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[#ffcf27]" />{session.venue}</p></div>}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-xs text-zinc-500">Roster</p><p className="mt-1 text-lg font-black">{count.paid} / {cap}</p></div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-xs text-zinc-500">Per player</p><p className="mt-1 text-lg font-black text-[#ffcf27]">{session ? `RM ${Number(session.deposit_amount).toFixed(2)}` : "See session"}</p></div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#ffcf27] transition-all" style={{ width: `${Math.min(100, count.paid / Math.max(cap, 1) * 100)}%` }} /></div>
                  <Link href={`/teams/${team.id}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold transition hover:border-[#ffcf27]/50 hover:bg-[#ffcf27]/5">View Team <ArrowRight size={16} /></Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function KeyRoundIcon() {
  return <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded border border-[#ffcf27] text-[9px] font-black text-[#ffcf27]">#</span>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 sm:p-4"><p className="text-xs text-zinc-500 sm:text-sm">{label}</p><p className="mt-2 text-2xl font-black text-[#ffcf27] sm:text-3xl">{value}</p></div>;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
