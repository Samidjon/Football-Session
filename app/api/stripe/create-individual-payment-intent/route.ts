import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request: Request) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY." }, { status: 500 });
    const { individualTeamId } = await request.json();
    if (!individualTeamId) return NextResponse.json({ error: "individualTeamId is required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: team, error } = await supabase.from("individual_teams").select("id, team_name, captain_id, status, deposit_amount").eq("id", individualTeamId).maybeSingle();
    if (error || !team) return NextResponse.json({ error: error?.message ?? "Team not found" }, { status: 404 });
    if (team.captain_id !== user.id) return NextResponse.json({ error: "You do not own this team" }, { status: 403 });
    if (team.status !== "not_counted") return NextResponse.json({ error: "This team does not require a deposit" }, { status: 400 });

    const amount = Number(team.deposit_amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "The organizer must set a deposit greater than RM0." }, { status: 400 });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "myr",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email ?? undefined,
      description: `MOTM Individuals — ${team.team_name} deposit`,
      metadata: { individual_team_id: team.id, captain_id: user.id, payment_type: "individual_team_deposit" }
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Individual team PaymentIntent error:", error);
    const message = error instanceof Error ? error.message : "Unknown Stripe error";
    return NextResponse.json({ error: `Could not create payment session: ${message}` }, { status: 500 });
  }
}
