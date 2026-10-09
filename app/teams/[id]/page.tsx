import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddPlayerForm } from "@/components/add-player-form";

export default async function TeamPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">Sign in required</h1>
        <Link
          href="/auth/login"
          className="mt-5 inline-block rounded-xl bg-[#ffcf27] px-5 py-3 font-semibold text-black"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const { data: team } = await supabase
    .from("teams")
    .select("*, sessions(*)")
    .eq("id", id)
    .single();

  if (!team) notFound();

  if (team.captain_id !== user.id) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">Access denied</h1>
        <p className="mt-2 text-zinc-400">
          Only the captain can manage this team.
        </p>
      </main>
    );
  }

  const { data: players } = await supabase
    .from("team_players")
    .select("*")
    .eq("team_id", id)
    .order("created_at", { ascending: true });

  const session = team.sessions as {
    title: string;
    players_per_team: number;
    deposit_amount: number;
    match_date: string;
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[#ffcf27]">{session.title}</p>
            <h1 className="mt-2 text-4xl font-black">{team.team_name}</h1>
            <p className="mt-2 text-zinc-400">
              {players?.length ?? 0} / {session.players_per_team} players
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/teams/${id}/edit`}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Edit team
            </Link>

            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                team.registration_status === "confirmed"
                  ? "bg-[#ffcf27]/10 text-[#ffcf27]"
                  : "bg-yellow-500/10 text-yellow-300"
              }`}
            >
              {team.registration_status === "confirmed"
                ? "Confirmed"
                : "Pending payment"}
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Info
            label="Deposit"
            value={`RM ${Number(session.deposit_amount).toFixed(0)}`}
          />
          <Info label="Session date" value={formatDate(session.match_date)} />
        </div>

        {team.registration_status === "pending_payment" && (
          <Link
            href={`/teams/${id}/payment`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#ffcf27] px-4 py-3 font-semibold text-black hover:bg-[#ffe477]"
          >
            Pay deposit
          </Link>
        )}
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Players</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Add names for your team. Players do not need accounts.
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {players?.length ?? 0}/{session.players_per_team}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {(players ?? []).map((player, index) => (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4"
            >
              <div className="flex items-center gap-4">
                <span className="w-6 text-sm text-zinc-600">{index + 1}</span>
                <span>{player.player_name}</span>
              </div>
              <span className="text-xs text-zinc-600">Player</span>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <AddPlayerForm
            teamId={id}
            disabled={(players?.length ?? 0) >= session.players_per_team}
          />
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
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
