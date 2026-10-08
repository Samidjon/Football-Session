import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditTeamForm } from "@/components/edit-team-form";
import { DeleteTeamButton } from "@/components/delete-team-button";

export default async function EditTeamPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, captain_id, sessions(title, players_per_team)")
    .eq("id", id)
    .single();

  if (!team) notFound();

  if (team.captain_id !== user.id) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">Access denied</h1>
        <p className="mt-2 text-zinc-400">
          Only the captain can edit this team.
        </p>
      </main>
    );
  }

  const { data: players } = await supabase
    .from("team_players")
    .select("id, player_name")
    .eq("team_id", id)
    .order("created_at", { ascending: true });

  const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;

  if (!session) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/teams/${id}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Back to team
      </Link>

      <div className="mt-8">
        <p className="font-semibold text-green-400">TEAM MANAGEMENT</p>
        <h1 className="mt-2 text-4xl font-black">Edit {team.team_name}</h1>
        <p className="mt-2 text-zinc-400">
          Update your team details and player list.
        </p>
      </div>

      <div className="mt-8">
        <EditTeamForm
          teamId={id}
          initialTeamName={team.team_name}
          players={players ?? []}
          playerLimit={session.players_per_team}
        />

        <div className="mt-8 rounded-2xl border border-red-950 bg-red-950/20 p-6">
          <h2 className="text-lg font-bold text-red-200">Delete team</h2>
          <p className="mt-1 text-sm leading-6 text-red-300/70">
            You can remove the team while it is still pending payment. Paid/confirmed teams must be handled by the organizer.
          </p>
          <div className="mt-4">
            <DeleteTeamButton teamId={id} />
          </div>
        </div>
      </div>
    </main>
  );
}
