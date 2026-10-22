import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditTeamForm } from "@/components/edit-team-form";
import { DeleteTeamButton } from "@/components/delete-team-button";
import { TeamInviteCodePanel } from "@/components/team-invite-code-panel";

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: team } = await supabase.from("teams").select("id, team_name, created_by, registration_status").eq("id", id).maybeSingle();
  if (!team) notFound();
  if (team.created_by !== user.id) return <main className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-black">Access denied</h1><p className="mt-3 text-zinc-400">Only the user who created this team can edit it.</p><Link href={`/teams/${id}`} className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View team</Link></main>;
  const { data: inviteCode } = await supabase.rpc("get_team_invite_code", { p_team_id: id });
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14"><Link href={`/teams/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to team</Link><div className="mt-7 motion-rise"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · Team settings</p><h1 className="mt-3 text-4xl font-black">Edit {team.team_name}</h1></div><TeamInviteCodePanel teamId={id} /><div className="mt-7"><EditTeamForm teamId={id} initialTeamName={team.team_name} initialInviteCode={inviteCode ?? ""} /></div>{team.registration_status === "pending_payment" && <div className="mt-6 rounded-2xl border border-red-900/70 bg-red-950/20 p-6"><h2 className="text-lg font-black text-red-200">Delete team</h2><p className="mt-2 text-sm leading-6 text-red-300/80">You can delete this team while nobody has paid to join it. Once a participant has paid, contact the organizer for cancellation/refunds.</p><div className="mt-4"><DeleteTeamButton teamId={id} /></div></div>}</main>;
}
