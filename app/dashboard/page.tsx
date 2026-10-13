import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: teams }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("teams").select("id, team_name, registration_status, session_id, sessions(title, match_date, deposit_amount)").eq("created_by", user.id).neq("registration_status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("team_memberships").select("id, team_id, player_name, status, paid_at, teams(id, team_name, session_id, sessions(title, match_date))").eq("user_id", user.id).order("created_at", { ascending: false })
  ]);

  const paidCount = (memberships ?? []).filter((item) => item.status === "paid").length;
  const pendingCount = (memberships ?? []).filter((item) => item.status === "pending_payment").length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#101b2d] via-zinc-950 to-[#1e2a15] p-7 sm:p-10 motion-rise">
        <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border-[24px] border-[#ffcf27]/10" />
        <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-[#ffcf27]">MOTM · YOUR ACCOUNT</p>
        <h1 className="relative mt-3 text-4xl font-black sm:text-5xl">Welcome, {profile?.full_name ?? "MOTM member"} 👋</h1>
        <p className="relative mt-3 max-w-xl leading-7 text-zinc-400">Create teams, join other squads, and manage your own paid registrations. There is no separate user role.</p>
        <div className="relative mt-7 flex flex-wrap gap-3"><Link href="/sessions" className="rounded-xl bg-[#ffcf27] px-5 py-3 font-black text-[#101522] transition hover:-translate-y-0.5 hover:bg-[#ffe477]">Browse sessions</Link><Link href="/individuals" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-white/5">Individuals directory</Link>{profile?.role === "organizer" && <Link href="/organizer" className="rounded-xl border border-[#ffcf27]/40 px-5 py-3 font-bold text-[#ffcf27] transition hover:bg-[#ffcf27]/10">Organizer dashboard</Link>}</div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={<Users size={19} />} label="Teams created" value={teams?.length ?? 0} />
        <Stat icon={<CheckCircle2 size={19} />} label="My paid places" value={paidCount} />
        <Stat icon={<Clock3 size={19} />} label="Payments to finish" value={pendingCount} />
      </section>

      <section className="mt-10 motion-rise motion-delay-1">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black sm:text-3xl">Teams I created</h2><p className="mt-2 text-sm text-zinc-400">Teams are public as soon as they are created; the roster shows only paid participants.</p></div><Link href="/sessions" className="text-sm font-bold text-[#ffcf27] hover:text-[#ffe477]">Find a session →</Link></div>
        {(teams?.length ?? 0) === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-8 text-zinc-500">You haven't created a team yet. Choose a session to get started.</div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teams?.map((team) => { const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions; return <Link key={team.id} href={`/teams/${team.id}`} className="interactive-card rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#ffcf27]">{session?.title ?? "Football session"}</p><h3 className="mt-2 text-xl font-black">{team.team_name}</h3><span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${team.registration_status === "confirmed" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{team.registration_status === "confirmed" ? "Active team" : "Awaiting first payment"}</span></Link>; })}</div>}
      </section>

      <section className="mt-10 motion-rise motion-delay-2">
        <div><h2 className="text-2xl font-black sm:text-3xl">My registrations</h2><p className="mt-2 text-sm text-zinc-400">Each user has an individual payment and registration status.</p></div>
        {(memberships?.length ?? 0) === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-8 text-zinc-500">You haven't joined a team yet. Open a team and pay for your place.</div> : <div className="mt-5 space-y-3">{memberships?.map((item) => { const team = Array.isArray(item.teams) ? item.teams[0] : item.teams; const session = team && (Array.isArray(team.sessions) ? team.sessions[0] : team.sessions); return <Link key={item.id} href={item.status === "paid" ? `/teams/${item.team_id}` : `/teams/${item.team_id}/payment`} className="interactive-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5"><div><p className="text-sm text-zinc-400">{session?.title ?? "Football session"}</p><h3 className="mt-1 font-bold">{team?.team_name ?? "Team"}</h3><p className="mt-1 text-xs text-zinc-500">{item.status === "paid" ? "Your place is paid" : "Your place is reserved temporarily while you pay"}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${item.status === "paid" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{item.status === "paid" ? "PAID · REGISTERED" : "PENDING PAYMENT"}</span></Link>; })}</div>}
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="interactive-card rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffcf27]/10 text-[#ffcf27]">{icon}</span><p className="mt-4 text-sm text-zinc-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>; }
