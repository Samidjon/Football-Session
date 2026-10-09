import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StripePayment } from "@/components/stripe-payment";

export default async function TeamPaymentPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, captain_id, registration_status, sessions(title, match_date, venue, deposit_amount)")
    .eq("id", id)
    .single();

  if (!team) notFound();

  if (team.captain_id !== user.id) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">Access denied</h1>
        <p className="mt-2 text-zinc-400">Only the captain can pay for this team.</p>
      </main>
    );
  }

  if (team.registration_status === "confirmed") {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffcf27]/10 text-[#ffcf27]">
          <ShieldCheck />
        </div>
        <h1 className="mt-5 text-3xl font-black">Payment already confirmed</h1>
        <p className="mt-2 text-zinc-400">
          {team.team_name} is confirmed for this session.
        </p>
        <Link
          href={`/teams/${id}`}
          className="mt-6 inline-block rounded-xl bg-[#ffcf27] px-5 py-3 font-semibold text-black"
        >
          Back to team
        </Link>
      </main>
    );
  }

  const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;

  if (!session) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={`/teams/${id}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Back to team
      </Link>

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
        <section>
          <p className="font-semibold text-[#ffcf27]">SECURE CHECKOUT</p>
          <h1 className="mt-2 text-4xl font-black">Pay team deposit</h1>
          <p className="mt-3 leading-7 text-zinc-400">
            Complete the deposit to secure your team slot. The team remains
            pending until Stripe reports a successful payment.
          </p>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-500">Team</p>
            <h2 className="mt-1 text-2xl font-bold">{team.team_name}</h2>

            <div className="mt-6 space-y-4 text-sm">
              <Row label="Session" value={session.title} />
              <Row label="Date" value={formatDate(session.match_date)} />
              <Row label="Venue" value={session.venue} />
              <Row label="Deposit" value={`RM ${Number(session.deposit_amount).toFixed(2)}`} />
              <Row label="Status" value="🟡 Pending payment" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
          <StripePayment teamId={id} />
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
