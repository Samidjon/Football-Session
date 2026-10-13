import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StripePayment } from "@/components/stripe-payment";

export default async function IndividualTeamPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/individuals/teams/${id}/payment`);

  const { data: team } = await supabase.from("individual_teams").select("id, team_name, status, deposit_amount, player_limit").eq("id", id).maybeSingle();
  if (!team || team.status === "cancelled") notFound();

  const [{ data: ownMembership }, { count: paidCount }] = await Promise.all([
    supabase.from("individual_team_memberships").select("id, status").eq("individual_team_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("individual_team_memberships").select("id", { count: "exact", head: true }).eq("individual_team_id", id).eq("status", "paid")
  ]);

  if (ownMembership?.status === "paid") return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300"><CheckCircle2 size={28} /></div><h1 className="mt-5 text-3xl font-black">You are already a member</h1><p className="mt-2 text-zinc-400">Your payment is confirmed and your name is on the public roster.</p><Link href={`/individuals/teams/${id}`} className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View team</Link></main>;
  const capacity = Number(team.player_limit ?? 30);
  if ((paidCount ?? 0) >= capacity) return <State title="Team full" message="Every place in this team has already been paid for." />;

  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 motm-page-enter"><Link href={`/individuals/teams/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to team</Link><div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]"><section className="motion-rise"><p className="font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · INDIVIDUALS</p><h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Join and pay</h1><p className="mt-4 leading-7 text-zinc-400">Creating the team is free. Pay the fee for your own place. Your name appears in the public roster only after Stripe confirms the payment.</p><div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 interactive-card"><p className="text-sm text-zinc-500">Team</p><h2 className="mt-1 text-2xl font-black">{team.team_name}</h2><div className="mt-6 space-y-4 text-sm"><Row label="Fee for your place" value={`RM ${Number(team.deposit_amount).toFixed(2)}`} /><Row label="Paid members" value={`${paidCount ?? 0} / ${capacity}`} /><Row label="Your status" value="Not joined yet" /></div></div></section><section className="motion-rise motion-delay-1 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8"><StripePayment teamId={id} mode="individual" /></section></div></main>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0"><span className="text-zinc-500">{label}</span><span className="text-right font-semibold">{value}</span></div>; }
function State({ title, message }: { title: string; message: string }) { return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-zinc-400">{message}</p><Link href="/individuals" className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Back to Individuals</Link></main>; }
