import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WhatsAppShareButton } from "@/components/whatsapp-share-button";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function IndividualPaymentSuccessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment_intent?: string }> }) {
  const { id } = await params;
  const { payment_intent: paymentIntentId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/individuals/teams/${id}/payment`);
  if (!stripe || !paymentIntentId) return <State title="Payment not verified" message="We could not verify this payment. Your name remains hidden until payment is confirmed." />;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata?.payment_type !== "individual_team_membership" || intent.metadata?.individual_team_id !== id || intent.metadata?.user_id !== user.id) return <State title="Payment mismatch" message="This payment does not belong to your membership in this team." />;
    if (intent.status !== "succeeded") return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300"><Clock3 size={32} /></div><h1 className="mt-6 text-4xl font-black">Payment pending</h1><p className="mt-3 text-zinc-400">Stripe has not confirmed this payment yet. Your name will stay hidden until payment succeeds.</p><Link href={`/individuals/teams/${id}/payment`} className="mt-7 inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-bold">Try again</Link></main>;

    const admin = createAdminClient();
    const { data: membership, error: readError } = await admin.from("individual_team_memberships")
      .select("id, individual_team_id, user_id, status, payment_intent_id")
      .eq("id", intent.metadata.membership_id)
      .eq("individual_team_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError || !membership) return <State title="Membership not found" message="The payment succeeded, but the reserved place could not be found. Contact the organizer with your Stripe payment reference." />;
    if (membership.payment_intent_id && membership.payment_intent_id !== intent.id) return <State title="Payment mismatch" message="This payment is not assigned to the current reservation." />;

    const { error: paymentError } = await admin.from("individual_team_member_payments").upsert({
      membership_id: membership.id,
      individual_team_id: id,
      user_id: user.id,
      amount: intent.amount / 100,
      status: "paid",
      payment_reference: intent.id,
      paid_at: new Date().toISOString()
    }, { onConflict: "membership_id" });
    if (paymentError) return <State title="Payment received" message="Stripe confirms the charge but the membership update needs organizer attention. Save this payment reference: " />;

    const { error: updateError } = await admin.from("individual_team_memberships").update({ status: "paid", paid_at: new Date().toISOString(), expires_at: null, payment_intent_id: intent.id }).eq("id", membership.id).eq("user_id", user.id);
    if (updateError) return <State title="Payment received" message="Stripe confirms the charge but the roster update needs organizer attention." />;

    const { data: team } = await admin.from("individual_teams").select("team_name").eq("id", id).maybeSingle();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://football-session.vercel.app").replace(/\/$/, "");
    const shareMessage = [
      `⚽ I just joined the "${team?.team_name ?? "MOTM"}" team!`,
      `See the team and join us: ${siteUrl}/individuals/teams/${id}`,
      "#MOTM"
    ].join("\n");
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300"><CheckCircle2 size={34} /></div>
        <h1 className="mt-6 text-4xl font-black">You joined the team</h1>
        <p className="mt-3 leading-7 text-zinc-400">Your place in {team?.team_name ?? "this team"} is paid. Your name is now shown on the public roster.</p>
        <p className="mt-2 text-xs text-zinc-500">Payment reference: {intent.id}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <WhatsAppShareButton message={shareMessage} />
          <Link href={`/individuals/teams/${id}`} className="inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-bold transition hover:bg-zinc-900">View public team</Link>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Individual membership payment verification error:", error);
    return <State title="Could not verify payment" message="Stripe returned an error while verifying your payment. Contact the organizer if your card was charged." />;
  }
}

function State({ title, message }: { title: string; message: string }) { return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-zinc-400">{message}</p><Link href="/individuals" className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Back to Individuals</Link></main>; }
