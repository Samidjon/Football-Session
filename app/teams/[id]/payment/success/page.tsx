import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export default async function PaymentSuccessPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_intent?: string; payment_intent_client_secret?: string }>; 
}) {
  const { id } = await params;
  const { payment_intent: paymentIntentId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  if (!paymentIntentId || !stripe) {
    return (
      <State
        title="Payment setup incomplete"
        message="Stripe could not verify this payment. Check your Stripe environment variables."
      />
    );
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, captain_id, registration_status")
    .eq("id", id)
    .single();

  if (!team || team.captain_id !== user.id) {
    return <State title="Access denied" message="This payment does not belong to your team." />;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata?.team_id !== id) {
      return <State title="Payment mismatch" message="This payment does not belong to this team." />;
    }

    if (paymentIntent.status === "succeeded") {
      const admin = createAdminClient();
      const paymentAmount = paymentIntent.amount / 100;

      const { error: paymentError } = await admin
        .from("payments")
        .upsert(
          {
            team_id: id,
            amount: paymentAmount,
            status: "paid",
            payment_reference: paymentIntent.id,
            paid_at: new Date().toISOString()
          },
          { onConflict: "team_id" }
        );

      if (!paymentError) {
        await admin
          .from("teams")
          .update({ registration_status: "confirmed" })
          .eq("id", id)
          .eq("captain_id", user.id);
      }

      return (
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-400">
            <CheckCircle2 size={34} />
          </div>
          <h1 className="mt-6 text-4xl font-black">Payment successful</h1>
          <p className="mt-3 leading-7 text-zinc-400">
            Your deposit has been received and your team is now confirmed.
          </p>
          <Link
            href={`/teams/${id}`}
            className="mt-7 inline-block rounded-xl bg-green-500 px-5 py-3 font-semibold text-black"
          >
            Go to team
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-300">
          <Clock3 size={34} />
        </div>
        <h1 className="mt-6 text-4xl font-black">Payment processing</h1>
        <p className="mt-3 leading-7 text-zinc-400">
          Stripe has not marked the payment as successful yet. Your team remains pending.
        </p>
        <Link
          href={`/teams/${id}`}
          className="mt-7 inline-block rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white hover:bg-zinc-900"
        >
          Back to team
        </Link>
      </main>
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    return (
      <State
        title="Could not verify payment"
        message="Stripe returned an error while checking the payment."
      />
    );
  }
}

function State({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="mt-3 text-zinc-400">{message}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-xl bg-green-500 px-5 py-3 font-semibold text-black"
      >
        Dashboard
      </Link>
    </main>
  );
}
