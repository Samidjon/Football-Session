import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IndividualTeamManager } from "@/components/individual-team-manager";

export default async function ManageIndividualTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/individuals/teams/${id}/manage`);

  const { data: team } = await supabase.from("individual_teams").select("id, team_name, captain_id, status, deposit_amount, player_limit").eq("id", id).maybeSingle();
  if (!team || team.status === "cancelled") notFound();
  if (team.captain_id !== user.id) return <main className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-black">Access denied</h1><p className="mt-3 text-zinc-400">Only the team creator can edit these details.</p><Link href={`/individuals/teams/${id}`} className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View public team</Link></main>;

  const { count } = await supabase.from("individual_team_memberships").select("id", { count: "exact", head: true }).eq("individual_team_id", id).eq("status", "paid");
  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter"><Link href={`/individuals/teams/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-[#ffcf27]"><ArrowLeft size={16} /> Public team page</Link><div className="mb-8 mt-7"><p className="font-bold text-[#ffcf27]">INDIVIDUAL TEAM TOOLS</p><h1 className="mt-2 text-4xl font-black">Manage {team.team_name}</h1><p className="mt-3 text-zinc-400">Manage the team name and capacity. Participants must join and pay for themselves.</p></div><IndividualTeamManager teamId={id} initialTeamName={team.team_name} initialPlayerLimit={Number(team.player_limit ?? 30)} depositAmount={Number(team.deposit_amount)} status={team.status} paidMembers={count ?? 0} /></main>;
}
