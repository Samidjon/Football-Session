import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StripePayment } from "@/components/stripe-payment";

export default async function TeamPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, registration_status, session_id, player_limit, sessions(title, match_date, venue, deposit_amount, players_per_team, status)")
    .eq("id", id)
    .maybeSingle();
  if (!team) notFound();

  const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;
  if (!session) notFound();
  const playerLimit = Number(team.player_limit ?? session.players_per_team);

  const { data: membership } = await supabase
    .from("team_memberships")
    .select("id, status, expires_at")
    .eq("team_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { count: paidMemberCount } = await supabase.from("team_memberships").select("id", { count: "exact", head: true }).eq("team_id", id).eq("status", "paid");
  if (membership?.status === "paid") {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={28} /></div>
        <h1 className="mt-5 text-3xl font-black">You are registered</h1>
        <p className="mt-2 text-zinc-400">Your payment is confirmed and your name is visible in the team roster.</p>
        <Link href={`/teams/${id}`} className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">View team</Link>
      </main>
    );
  }

  if (!["open", "full"].includes(session.status)) {
    return <State title="Registration closed" message="This session is no longer accepting paid participants." />;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href={`/teams/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#ffcf27]"><ArrowLeft size={16} /> Back to team</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="motion-rise">
          <p className="font-bold uppercase tracking-[0.22em] text-[#ffcf27]">MOTM · SECURE CHECKOUT</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Pay for your spot</h1>
          <p className="mt-4 leading-7 text-zinc-400">Every person pays individually. Your name becomes visible in the public roster only after Stripe confirms your payment.</p>
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 interactive-card">
            <p className="text-sm text-zinc-500">Team</p><h2 className="mt-1 text-2xl font-black">{team.team_name}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <Row label="Session" value={session.title} />
              <Row label="Date" value={formatDate(session.match_date)} />
              <Row label="Venue" value={session.venue} />
              <Row label="Your registration fee" value={`RM ${Number(session.deposit_amount).toFixed(2)}`} />
              <Row label="Team capacity" value={`${paidMemberCount ?? 0} / ${playerLimit} paid`} />
              <Row label="Your status" value="Not registered yet" />
            </div>
          </div>
        </section>
        <section className="motion-rise motion-delay-1 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8">
          <StripePayment teamId={id} />
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0"><span className="text-zinc-500">{label}</span><span className="text-right font-semibold">{value}</span></div>;
}
function State({ title, message }: { title: string; message: string }) {
  return <main className="mx-auto max-w-xl px-6 py-20 text-center motion-rise"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-zinc-400">{message}</p><Link href="/sessions" className="mt-6 inline-flex rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522]">Browse sessions</Link></main>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
