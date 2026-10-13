import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function PaymentSuccessPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_intent?: string; payment_intent_client_secret?: string }>;
}) {
  const { id } = await params;
  const { payment_intent: paymentIntentId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  if (!paymentIntentId || !stripe) return <State title="Payment setup incomplete" message="Stripe could not verify this payment. Check the server environment variables." />;

  const { data: team } = await supabase.from("teams").select("id, team_name, session_id").eq("id", id).maybeSingle();
  if (!team) return <State title="Team not found" message="This team could not be found." />;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const membershipId = paymentIntent.metadata?.membership_id;
    if (paymentIntent.metadata?.team_id !== id || paymentIntent.metadata?.user_id !== user.id || paymentIntent.metadata?.payment_type !== "session_team_member" || !membershipId) {
      return <State title="Payment mismatch" message="This payment does not belong to your account or this team." />;
    }

    if (paymentIntent.status === "succeeded") {
      const admin = createAdminClient();
      const { data: member, error: memberError } = await admin.from("team_memberships")
        .select("id, team_id, user_id, player_name, status")
        .eq("id", membershipId).eq("team_id", id).eq("user_id", user.id).maybeSingle();
      if (memberError || !member) return <State title="Reservation not found" message="Stripe received the payment, but the reserved place could not be found. Contact the organizer with your payment reference." />;

      const { error: ledgerError } = await admin.from("team_member_payments").upsert({
        membership_id: member.id,
        team_id: id,
        user_id: user.id,
        amount: paymentIntent.amount / 100,
        status: "paid",
        payment_reference: paymentIntent.id,
        paid_at: new Date().toISOString()
      }, { onConflict: "membership_id" });
      if (ledgerError) {
        console.error("Membership payment ledger error:", ledgerError);
        return <State title="Payment received" message="Stripe reports your payment as successful, but the site could not finalize it yet. Refresh this page in a moment." />;
      }

      const { error: membershipError } = await admin.from("team_memberships").update({ status: "paid", paid_at: new Date().toISOString(), expires_at: null })
        .eq("id", member.id).eq("user_id", user.id);
      if (membershipError) {
        console.error("Membership finalize error:", membershipError);
        return <State title="Payment received" message="Stripe reports your payment as successful, but your roster update is still processing. Refresh this page shortly." />;
      }

      await admin.from("teams").update({ registration_status: "confirmed" }).eq("id", id).eq("registration_status", "pending_payment");

      return (
        <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 animate-pop-in"><CheckCircle2 size={34} /></div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-[#ffcf27]">MOTM · Registration confirmed</p>
          <h1 className="mt-3 text-4xl font-black">You’re in!</h1>
          <p className="mt-3 leading-7 text-zinc-400">Your personal fee has been paid. Your name is now visible in {team.team_name}’s public squad.</p>
          <Link href={`/teams/${id}`} className="mt-7 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477]">View team</Link>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-300"><Clock3 size={34} /></div>
        <h1 className="mt-6 text-4xl font-black">Payment still processing</h1>
        <p className="mt-3 leading-7 text-zinc-400">Stripe has not marked the payment as successful. Your name remains hidden from the public roster until payment is confirmed.</p>
        <Link href={`/teams/${id}/payment`} className="mt-7 inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-900">Return to payment</Link>
      </main>
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    return <State title="Could not verify payment" message="Stripe returned an error while checking the payment." />;
  }
}

function State({ title, message }: { title: string; message: string }) {
  return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-zinc-400">{message}</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Dashboard</Link></main>;
}
