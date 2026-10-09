import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IndividualTeamManager } from "@/components/individual-team-manager";

export default async function ManageIndividualTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: team } = await supabase.from("individual_teams").select("id, team_name, captain_id, status, deposit_amount").eq("id", id).maybeSingle();
  if (!team) notFound();
  if (team.captain_id !== user.id) return <main className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-black">Access denied</h1><p className="mt-3 text-zinc-400">Only this team’s captain can manage its roster.</p><Link href={`/individuals/teams/${id}`} className="mt-6 inline-block rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View public squad</Link></main>;

  const { data: players } = await supabase.from("individual_players").select("id, player_name").eq("individual_team_id", id).order("created_at", { ascending: true });
  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14"><Link href={`/individuals/teams/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Public squad page</Link><div className="mt-7 mb-8"><p className="font-bold text-[#ffcf27]">CAPTAIN TOOLS</p><h1 className="mt-2 text-4xl font-black">Manage {team.team_name}</h1><p className="mt-3 text-zinc-400">Changes appear on the public squad page immediately.</p></div><IndividualTeamManager teamId={id} initialTeamName={team.team_name} initialPlayers={players ?? []} depositAmount={Number(team.deposit_amount)} status={team.status} /></main>;
}
