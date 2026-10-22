import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { WhatsAppShareButton } from "@/components/whatsapp-share-button";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function IndividualPaymentSuccessPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_intent?: string; payment_intent_client_secret?: string }>;
}) {
  const { id } = await params;
  const { payment_intent: paymentIntentId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/individuals/${id}/payment`);
  if (!paymentIntentId || !stripe) return <State title="Payment setup incomplete" message="Stripe could not verify this payment. Check the server environment variables." />;

  const { data: team } = await supabase.from("individual_teams").select("id,team_name,deposit_amount").eq("id", id).maybeSingle();
  if (!team) return <State title="Team not found" message="This team could not be found." />;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const membershipId = intent.metadata?.membership_id;
    if (intent.metadata?.individual_team_id !== id || intent.metadata?.user_id !== user.id || intent.metadata?.payment_type !== "individual_team_membership" || !membershipId) {
      return <State title="Payment mismatch" message="This payment does not belong to your account or this team." />;
    }

    if (intent.status === "succeeded") {
      const admin = createAdminClient();
      const { data: membership, error: membershipReadError } = await admin.from("individual_team_memberships")
        .select("id,individual_team_id,user_id,player_name,status").eq("id", membershipId).eq("individual_team_id", id).eq("user_id", user.id).maybeSingle();
      if (membershipReadError || !membership) return <State title="Reservation not found" message="Stripe received the payment, but the reserved place could not be found. Contact the organizer with your payment reference." />;

      const paidAt = new Date().toISOString();
      const { error: ledgerError } = await admin.from("individual_team_member_payments").upsert({
        membership_id: membership.id,
        individual_team_id: id,
        user_id: user.id,
        amount: intent.amount / 100,
        status: "paid",
        payment_reference: intent.id,
        paid_at: paidAt,
      }, { onConflict: "membership_id" });
      if (ledgerError) {
        console.error("Individual membership payment ledger error:", ledgerError);
        return <State title="Payment received" message="Stripe confirms your payment, but the roster is still updating. Refresh this page shortly." />;
      }

      const { error: updateError } = await admin.from("individual_team_memberships").update({ status: "paid", paid_at: paidAt, expires_at: null }).eq("id", membership.id).eq("user_id", user.id);
      if (updateError) {
        console.error("Individual membership finalization error:", updateError);
        return <State title="Payment received" message="Stripe confirms your payment, but your roster update is still processing. Refresh this page shortly." />;
      }
      await admin.from("individual_teams").update({ status: "counted" }).eq("id", id).neq("status", "cancelled");

      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://football-session.vercel.app").replace(/\/$/, "");
      const message = [`⚽ I just joined ${team.team_name} on MOTM!`, `💳 My place is confirmed — RM ${Number(team.deposit_amount).toFixed(2)}`, `Join the same team: ${siteUrl}/individuals/${id}`, "#MOTM"].join("\n");
      return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 animate-pop-in"><CheckCircle2 size={34} /></div><p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-[#ffcf27]">MOTM · Registration confirmed</p><h1 className="mt-3 text-4xl font-black">You’re in!</h1><p className="mt-3 leading-7 text-zinc-400">Your individual fee is paid. Your name is now visible in {team.team_name}’s roster.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><WhatsAppShareButton message={message} /><Link href={`/individuals/${id}`} className="inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-bold transition hover:bg-zinc-900">View team</Link></div></main>;
    }

    return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-300"><Clock3 size={34} /></div><h1 className="mt-6 text-4xl font-black">Payment still processing</h1><p className="mt-3 leading-7 text-zinc-400">Your name remains hidden until payment is confirmed.</p><Link href={`/individuals/${id}/payment`} className="mt-7 inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-900">Return to payment</Link></main>;
  } catch (error) {
    console.error("Individual payment verification error:", error);
    return <State title="Could not verify payment" message="Stripe returned an error while checking the payment." />;
  }
}

function State({ title, message }: { title: string; message: string }) {
  return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-zinc-400">{message}</p><Link href="/individuals" className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Browse teams</Link></main>;
}
