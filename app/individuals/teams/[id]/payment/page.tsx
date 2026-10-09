import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StripePayment } from "@/components/stripe-payment";

export default async function IndividualTeamPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: team } = await supabase.from("individual_teams").select("id, team_name, captain_id, status, deposit_amount").eq("id", id).maybeSingle();
  if (!team) notFound();
  if (team.captain_id !== user.id) return <main className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-black">Access denied</h1><p className="mt-3 text-zinc-400">Only the captain can pay this deposit.</p></main>;
  if (team.status === "counted") return <main className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-black">Deposit already paid</h1><p className="mt-3 text-zinc-400">This squad is counted as active.</p><Link href={`/individuals/teams/${id}`} className="mt-6 inline-block rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Back to squad</Link></main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14"><Link href={`/individuals/teams/${id}/manage`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Back to team</Link><div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><section><p className="font-bold text-[#ffcf27]">MOTM INDIVIDUALS</p><h1 className="mt-2 text-4xl font-black">Pay team deposit</h1><p className="mt-3 leading-7 text-zinc-400">You can pay when ready. After Stripe confirms the payment, this team’s status changes from Not counted to Counted.</p><div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"><p className="text-sm text-zinc-500">Team</p><h2 className="mt-1 text-2xl font-black">{team.team_name}</h2><div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4"><span className="text-zinc-400">Deposit</span><strong className="text-3xl">RM {Number(team.deposit_amount).toFixed(2)}</strong></div><p className="mt-4 text-sm text-amber-300">Current status: Not counted</p></div></section><section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8"><StripePayment teamId={id} mode="individual" /></section></div></main>;
}
