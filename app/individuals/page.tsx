import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { SessionActions } from "@/components/session-actions";
import { SessionCard } from "@/components/session-card";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/types";

export default async function IndividualsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isOrganizer = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isOrganizer = profile?.role === "organizer";
  }

  const { data } = await supabase.from("sessions").select("*")
    .order("match_date", { ascending: true })
    .order("start_time", { ascending: true });

  const allSessions = (data ?? []) as Session[];
  const sessions = isOrganizer
    ? allSessions
    : allSessions.filter((session) => session.status === "open" || session.status === "full");

  const teamCounts = await Promise.all(sessions.map(async (session) => {
    const { count } = await supabase.from("teams").select("id", { count: "exact", head: true })
      .eq("session_id", session.id).neq("registration_status", "cancelled");
    return [session.id, count ?? 0] as const;
  }));
  const counts = new Map(teamCounts);
  const openCount = sessions.filter((session) => session.status === "open").length;
  const fullCount = sessions.filter((session) => session.status === "full").length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter">
      <section className="motm-individuals-hero relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-7 md:p-10 motm-hero-glow">
        <div className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full border-[26px] border-[#ffcf27]/10" />
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · INDIVIDUALS</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Find your session.<br /><span className="text-[#ffcf27]">Join and play.</span></h1>
            <p className="mt-5 max-w-2xl leading-7 text-zinc-300">Explore public football sessions, check the date and venue, then open a session to reserve your place or create a team.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {isOrganizer ? (
                <Link href="/organizer/sessions/new" className="motm-button-pop inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Create a session <ArrowRight size={18} /></Link>
              ) : (
                <Link href="/sessions" className="motm-button-pop inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Browse sessions <ArrowRight size={18} /></Link>
              )}
              {isOrganizer ? (
                <Link href="/organizer" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800">Manage sessions</Link>
              ) : (
                <Link href="/auth/register" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800">Join MOTM</Link>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:min-w-64 md:grid-cols-1">
            <Stat label="Open sessions" value={openCount} tone="open" />
            <Stat label="Full sessions" value={fullCount} tone="full" />
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-4 border-t border-white/10 pt-5 text-sm text-zinc-300">
          <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> Public match dates</span>
          <span className="inline-flex items-center gap-2"><MapPin size={16} /> Venues and formats</span>
          <span className="inline-flex items-center gap-2"><Users size={16} /> Individual places available</span>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black md:text-3xl">Public Sessions</h2>
            <p className="mt-2 text-zinc-400">Anyone can browse these sessions. Only an administrator can create, edit, or delete them.</p>
          </div>
          <span className="text-sm text-zinc-500">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span>
        </div>

        {sessions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-10 text-center">
            <p className="text-lg font-semibold">No public sessions yet</p>
            <p className="mt-2 text-zinc-500">{isOrganizer ? "Create the first session to publish it here." : "Please check back soon for upcoming football sessions."}</p>
            {isOrganizer && <Link href="/organizer/sessions/new" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Create a session <ArrowRight size={18} /></Link>}
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3 motm-stagger">
            {sessions.map((session) => {
              const count = counts.get(session.id) ?? 0;
              const canManage = isOrganizer && session.created_by === user?.id;
              return (
                <div key={session.id} className="flex min-w-0 flex-col gap-3">
                  <SessionCard session={session} teamCount={count} />
                  {isOrganizer && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{session.status.replaceAll("_", " ")}</span>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <Link href={`/organizer/sessions/${session.id}/edit`} className="rounded-lg border border-[#ffcf27]/40 px-3 py-2 text-sm font-semibold text-[#8a6500] transition hover:bg-[#ffcf27]/10">Edit</Link>
                          <SessionActions sessionId={session.id} />
                        </div>
                      ) : <span className="text-xs text-zinc-500">Managed by another organizer</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "open" | "full" }) {
  return (
    <div className="interactive-card rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone === "open" ? "text-emerald-400" : "text-amber-300"}`}>{value}</p>
    </div>
  );
}
