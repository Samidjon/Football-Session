import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function IndividualPaymentSuccessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment_intent?: string }> }) {
  const { id } = await params;
  const { payment_intent: paymentIntentId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: team } = await supabase.from("individual_teams").select("id, team_name, captain_id, status").eq("id", id).maybeSingle();
  if (!team || team.captain_id !== user.id) return <State title="Access denied" message="This payment does not belong to your team." />;
  if (!stripe || !paymentIntentId) return <State title="Payment not verified" message="We could not verify this payment. The team remains Not counted." />;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata?.individual_team_id !== id || intent.metadata?.captain_id !== user.id) return <State title="Payment mismatch" message="This payment does not belong to this team." />;
    if (intent.status === "succeeded") {
      const admin = createAdminClient();
      const { error: paymentError } = await admin.from("individual_payments").upsert({ individual_team_id: id, amount: intent.amount / 100, status: "paid", payment_reference: intent.id, paid_at: new Date().toISOString() }, { onConflict: "individual_team_id" });
      if (paymentError) return <State title="Payment received" message="Stripe reports that payment succeeded, but the team status could not be updated automatically. Please contact the organizer." />;
      const { error: teamError } = await admin.from("individual_teams").update({ status: "counted" }).eq("id", id).eq("captain_id", user.id);
      if (teamError) return <State title="Payment received" message="Stripe reports that payment succeeded, but the team status could not be updated automatically. Please contact the organizer." />;
      return <main className="mx-auto max-w-xl px-6 py-20 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={34} /></div><h1 className="mt-6 text-4xl font-black">Deposit paid</h1><p className="mt-3 leading-7 text-zinc-400">{team.team_name} is now Counted and included in the active individual teams total.</p><Link href={`/individuals/teams/${id}`} className="mt-7 inline-block rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View public squad</Link></main>;
    }
    return <main className="mx-auto max-w-xl px-6 py-20 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-300"><Clock3 size={34} /></div><h1 className="mt-6 text-4xl font-black">Payment pending</h1><p className="mt-3 leading-7 text-zinc-400">Stripe has not confirmed successful payment yet. The team remains Not counted.</p><Link href={`/individuals/teams/${id}/payment`} className="mt-7 inline-block rounded-xl border border-zinc-700 px-5 py-3 font-semibold">Try payment again</Link></main>;
  } catch (error) {
    console.error("Individual payment verification error:", error);
    return <State title="Could not verify payment" message="Stripe returned an error while verifying the payment." />;
  }
}

function State({ title, message }: { title: string; message: string }) {
  return <main className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-zinc-400">{message}</p><Link href="/individuals" className="mt-6 inline-block rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Back to Individuals</Link></main>;
}
