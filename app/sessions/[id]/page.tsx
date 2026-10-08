import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RegisterTeamForm } from "@/components/register-team-form";
import type { Session, Team } from "@/lib/types";

export default async function SessionDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sessionData } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (!sessionData) notFound();

  const session = sessionData as Session;

  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .eq("session_id", id)
    .neq("registration_status", "cancelled")
    .order("created_at", { ascending: true });

  const teams = (teamsData ?? []) as Team[];

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/sessions"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Back to sessions
      </Link>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <section>
          <span className="inline-flex rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-400">
            {session.format}
          </span>

          <h1 className="mt-4 text-4xl font-black">{session.title}</h1>

          {session.description && (
            <p className="mt-3 max-w-2xl leading-7 text-zinc-400">{session.description}</p>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Info icon={<CalendarDays size={18} />} text={formatDate(session.match_date)} />
            <Info icon={<Clock3 size={18} />} text={`${session.start_time.slice(0, 5)} – ${session.end_time.slice(0, 5)}`} />
            <Info icon={<MapPin size={18} />} text={session.venue} />
            <Info icon={<Users size={18} />} text={`${session.players_per_team} players / team`} />
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-bold">Team slots</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: session.max_teams }).map((_, index) => {
                const team = teams[index];

                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Team Slot {index + 1}
                    </p>

                    {team ? (
                      <>
                        <h3 className="mt-3 text-xl font-bold">{team.team_name}</h3>
                        <p className="mt-2 text-sm text-zinc-400">
                          {team.registration_status === "confirmed"
                            ? "🟢 Confirmed"
                            : "🟡 Pending payment"}
                        </p>

                        <Link
                          href={`/teams/${team.id}/squad`}
                          className="mt-4 inline-flex rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
                        >
                          View squad
                        </Link>
                      </>
                    ) : (
                      <>
                        <h3 className="mt-3 text-xl font-bold text-zinc-400">Available</h3>
                        <p className="mt-2 text-sm text-zinc-500">Open for registration</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside>
          <div className="sticky top-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
            <p className="text-sm text-zinc-400">Required deposit</p>
            <p className="mt-1 text-4xl font-black">
              RM {session.deposit_amount.toFixed(0)}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {teams.length} / {session.max_teams} slots currently registered.
            </p>

            <div className="mt-6">
              {user ? (
                <RegisterTeamForm sessionId={session.id} />
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <p className="text-sm leading-6 text-zinc-400">
                    Sign in as a captain to register your team.
                  </p>
                  <Link
                    href="/auth/login"
                    className="mt-4 block w-full rounded-xl bg-green-500 px-4 py-3 text-center font-semibold text-black hover:bg-green-400"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Info({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
      <span className="text-green-400">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
