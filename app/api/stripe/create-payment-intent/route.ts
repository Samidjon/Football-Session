import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local." },
        { status: 500 }
      );
    }

    const { teamId } = await request.json();

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, team_name, captain_id, registration_status, session_id, sessions(id, title, deposit_amount)")
      .eq("id", teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        { error: teamError?.message ?? "Team not found" },
        { status: 404 }
      );
    }

    if (team.captain_id !== user.id) {
      return NextResponse.json({ error: "You do not own this team" }, { status: 403 });
    }

    if (team.registration_status !== "pending_payment") {
      return NextResponse.json(
        { error: "This team does not require payment" },
        { status: 400 }
      );
    }

    const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const amount = Number(session.deposit_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid deposit amount" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "myr",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email ?? undefined,
      description: `${session.title} — ${team.team_name} deposit`,
      metadata: {
        team_id: team.id,
        captain_id: user.id,
        session_id: session.id
      }
    });

    // The payment record is finalized only after Stripe reports a successful PaymentIntent.
    // This keeps the database from showing a paid/active payment before the card charge succeeds.

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error("Stripe PaymentIntent error:", error);
    const message = error instanceof Error ? error.message : "Unknown Stripe error";
    return NextResponse.json(
      { error: `Could not create payment session: ${message}` },
      { status: 500 }
    );
  }
}
