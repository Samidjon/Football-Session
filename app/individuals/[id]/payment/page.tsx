import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StripePayment } from "@/components/stripe-payment";

export default async function IndividualTeamPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/individuals/${id}/payment`);

  const { data: team } = await supabase.from("individual_teams").select("id,team_name,status,deposit_amount,player_limit").eq("id", id).maybeSingle();
  if (!team || team.status === "cancelled") notFound();

  const [{ data: membership }, { count }] = await Promise.all([
    supabase.from("individual_team_memberships").select("id,status,expires_at").eq("individual_team_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("individual_team_memberships").select("id", { count: "exact", head: true }).eq("individual_team_id", id).eq("status", "paid"),
  ]);

  if (membership?.status === "paid") {
    return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={28} /></div><h1 className="mt-5 text-3xl font-black">You are registered</h1><p className="mt-2 text-zinc-400">Your payment is confirmed and your name is visible in the roster.</p><Link href={`/individuals/${id}`} className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View team</Link></main>;
  }
  const capacity = Number(team.player_limit || 30);
  if ((count ?? 0) >= capacity) {
    return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><h1 className="text-3xl font-black">This team is full</h1><p className="mt-3 text-zinc-400">There are no paid spots left in this team.</p><Link href={`/individuals/${id}`} className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Back to team</Link></main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href={`/individuals/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to team</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="motion-rise"><p className="font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · INDIVIDUAL CHECKOUT</p><h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Reserve your place</h1><p className="mt-4 leading-7 text-zinc-400">Every player pays their own fee. Your name appears in the team roster only after Stripe confirms the payment.</p>
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 interactive-card"><p className="text-sm text-zinc-500">Team</p><h2 className="mt-1 text-2xl font-black">{team.team_name}</h2><div className="mt-6 space-y-4 text-sm"><Row label="Your fee" value={`RM ${Number(team.deposit_amount).toFixed(2)}`} /><Row label="Registered players" value={`${count ?? 0} / ${capacity}`} /><Row label="Your status" value="Awaiting payment" /></div></div>
        </section>
        <section className="motion-rise motion-delay-1 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8"><StripePayment teamId={id} mode="individual" /></section>
      </div>
    </main>
  );
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0"><span className="text-zinc-500">{label}</span><span className="text-right font-semibold">{value}</span></div>; }
