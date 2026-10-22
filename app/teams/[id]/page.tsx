import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamInviteCodePanel } from "@/components/team-invite-code-panel";
import { TeamJoinCodeGate } from "@/components/team-join-code-gate";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: team }, { data: { user } }] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id, team_name, created_by, registration_status, session_id, player_limit, sessions(id, title, match_date, start_time, end_time, venue, players_per_team, deposit_amount, status, max_teams)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!team) notFound();

  const session = Array.isArray(team.sessions)
    ? team.sessions[0]
    : team.sessions;

  if (!session) notFound();

  // Only successfully paid participants appear in the public roster.
  const { data: roster } = await supabase
    .from("team_memberships")
    .select("id, player_name, paid_at")
    .eq("team_id", id)
    .eq("status", "paid")
    .order("paid_at", { ascending: true });

  const players = roster ?? [];
  const isCreator = user?.id === team.created_by;

  // Check the current user's membership, including an unfinished payment.
  const { data: ownMembership } = user
    ? await supabase
        .from("team_memberships")
        .select("id, status")
        .eq("team_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const alreadyJoined = ownMembership?.status === "paid";
  const playerLimit = Number(
    team.player_limit ?? session.players_per_team
  );
  const placesLeft = Math.max(0, playerLimit - players.length);
  const registrationOpen = ["open", "full"].includes(session.status);

  // The session.id field is explicitly selected above, fixing TS2339.
  const { data: sessionTeams } = await supabase
    .from("teams")
    .select("id, registration_status")
    .eq("session_id", session.id)
    .neq("registration_status", "cancelled");

  const countedTeamCount = (sessionTeams ?? []).filter(
    (item) => item.registration_status === "confirmed"
  ).length;

  const pendingTeamIds = (sessionTeams ?? [])
    .filter((item) => item.registration_status === "pending_payment")
    .map((item) => item.id);

  let reservedPendingTeamIds = new Set<string>();

  if (pendingTeamIds.length > 0) {
    const admin = createAdminClient();

    const { data: liveReservations } = await admin
      .from("team_memberships")
      .select("team_id")
      .in("team_id", pendingTeamIds)
      .eq("status", "pending_payment")
      .gt("expires_at", new Date().toISOString());

    reservedPendingTeamIds = new Set(
      (liveReservations ?? []).map((row) => row.team_id)
    );
  }

  const canActivateTeam =
    team.registration_status === "confirmed" ||
    reservedPendingTeamIds.has(team.id) ||
    countedTeamCount + reservedPendingTeamIds.size <
      Number(session.max_teams);

  const teamCounted =
    team.registration_status === "confirmed" || players.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
      <Link
        href={`/sessions/${team.session_id}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"
      >
        <ArrowLeft size={16} />
        Back to session
      </Link>

      <section className="motion-rise relative mt-7 overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-[#111827] via-zinc-950 to-[#102449] p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-8 -top-10 h-52 w-52 rounded-full border-[24px] border-[#ffcf27]/10" />

        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ffcf27]">
              MOTM · Team
            </p>

            <h1 className="mt-3 break-words text-4xl font-black tracking-tight sm:text-5xl">
              {team.team_name}
            </h1>

            <p className="mt-3 text-zinc-400">{session.title}</p>
          </div>

          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${
              teamCounted
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-200"
            }`}
          >
            {teamCounted ? (
              <CheckCircle2 size={16} />
            ) : (
              <Clock3 size={16} />
            )}

            {teamCounted ? "Active team" : "Awaiting first payment"}
          </span>
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            icon={<CalendarDays size={17} />}
            label="Date"
            value={formatDate(session.match_date)}
          />

          <Info
            icon={<Clock3 size={17} />}
            label="Time"
            value={`${session.start_time.slice(0, 5)} – ${session.end_time.slice(0, 5)}`}
          />

          <Info
            icon={<MapPin size={17} />}
            label="Venue"
            value={session.venue}
          />

          <Info
            icon={<Users size={17} />}
            label="Paid players"
            value={`${players.length} / ${playerLimit}`}
          />
        </div>

        <div className="relative mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">
              Personal session fee
            </p>

            <p className="mt-1 text-3xl font-black text-[#ffcf27]">
              RM {Number(session.deposit_amount).toFixed(2)}
              <span className="text-sm font-medium text-zinc-400">
                {" "}/ person
              </span>
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Your name appears in the roster after successful payment.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isCreator && (
              <Link
                href={`/teams/${id}/edit`}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
              >
                Edit team
              </Link>
            )}

            {alreadyJoined ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
                <CheckCircle2 size={16} />
                You are registered
              </span>
            ) : !user ? (
              <Link
                href={`/auth/login?next=/teams/${id}`}
                className="rounded-xl bg-[#ffcf27] px-5 py-3 text-sm font-black text-[#101522] transition hover:bg-[#ffe477]"
              >
                Sign in to join
              </Link>
            ) : !registrationOpen ? (
              <span className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-400">
                Registration closed
              </span>
            ) : placesLeft <= 0 ? (
              <span className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-400">
                Team full
              </span>
            ) : !canActivateTeam ? (
              <span className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-400">
                All team slots are counted
              </span>
            ) : (
              <TeamJoinCodeGate teamId={id} />
            )}
          </div>
        </div>
      </section>

      {isCreator && <TeamInviteCodePanel teamId={id} />}

      <section className="motion-rise motion-delay-1 mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffcf27]">
              Public roster
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Team members
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Only participants with successful payments are shown here.
            </p>
          </div>

          <span className="rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-400">
            {players.length} paid · {placesLeft} places left
          </span>
        </div>

        {players.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-9 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffcf27]/10 text-[#ffcf27]">
              <Users size={24} />
            </div>

            <h3 className="mt-4 text-lg font-bold">
              No paid players yet
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              This team is public, but the roster starts filling after each
              participant pays for their own place.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player, index) => (
              <article
                key={player.id}
                className="interactive-card motion-rise flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/65 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffcf27]/10 text-sm font-black text-[#ffcf27]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0">
                  <span className="block truncate font-bold">
                    {player.player_name}
                  </span>
                  <span className="mt-1 block text-xs text-emerald-400">
                    Paid · Registered
                  </span>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[#ffcf27]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </span>
      </div>

      <p className="mt-2 break-words text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}