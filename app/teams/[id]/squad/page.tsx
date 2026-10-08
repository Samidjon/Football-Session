import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TeamSquadPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, registration_status, session_id, sessions(title, match_date, venue, players_per_team)")
    .eq("id", id)
    .single();

  if (!team) notFound();

  const { data: players, error } = await supabase
    .from("team_players")
    .select("id, player_name")
    .eq("team_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const session = Array.isArray(team.sessions)
    ? team.sessions[0]
    : team.sessions;

  if (!session) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/sessions/${team.session_id}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to session
      </Link>

      <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-400">
              Team squad
            </p>
            <h1 className="mt-2 text-4xl font-black">{team.team_name}</h1>
            <p className="mt-2 text-zinc-400">
              {session.title} · {formatDate(session.match_date)}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              team.registration_status === "confirmed"
                ? "bg-green-500/10 text-green-400"
                : "bg-yellow-500/10 text-yellow-300"
            }`}
          >
            {team.registration_status === "confirmed"
              ? "Confirmed"
              : "Pending payment"}
          </span>
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
            <Users size={21} />
          </div>
          <div>
            <p className="font-semibold">
              {players?.length ?? 0} / {session.players_per_team} players
            </p>
            <p className="text-sm text-zinc-500">
              Team lineup
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold">Players</h2>

          {(players?.length ?? 0) === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
              No players have been added yet.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {players?.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-zinc-500">
                    {index + 1}
                  </span>
                  <span className="font-medium">{player.player_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
