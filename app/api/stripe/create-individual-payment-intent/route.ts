import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request: Request) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY." }, { status: 500 });
    const { individualTeamId } = await request.json();
    if (!individualTeamId || typeof individualTeamId !== "string") return NextResponse.json({ error: "individualTeamId is required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: team, error: teamError } = await supabase.from("individual_teams")
      .select("id, team_name, status, deposit_amount, player_limit")
      .eq("id", individualTeamId).maybeSingle();
    if (teamError || !team) return NextResponse.json({ error: teamError?.message ?? "Team not found" }, { status: 404 });
    if (team.status === "cancelled") return NextResponse.json({ error: "This team has been cancelled" }, { status: 400 });

    const amount = Number(team.deposit_amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "The organizer must configure a per-person fee greater than RM0." }, { status: 400 });

    const { data: membershipId, error: reserveError } = await supabase.rpc("reserve_individual_team_membership", { p_team_id: individualTeamId });
    if (reserveError || !membershipId) return NextResponse.json({ error: reserveError?.message ?? "Could not reserve a place in this team" }, { status: 409 });

    const admin = createAdminClient();
    const { data: membership } = await admin.from("individual_team_memberships")
      .select("id, user_id, status, payment_intent_id, expires_at")
      .eq("id", membershipId).eq("user_id", user.id).maybeSingle();
    if (!membership || membership.status === "paid") return NextResponse.json({ error: "This membership is already paid or could not be reserved" }, { status: 409 });

    if (membership.payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(membership.payment_intent_id);
        if (["requires_payment_method", "requires_action", "requires_confirmation", "processing"].includes(existing.status) && existing.client_secret) {
          return NextResponse.json({ clientSecret: existing.client_secret });
        }
      } catch {
        // Create a fresh intent only if the previous one cannot be reused.
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "myr",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email ?? undefined,
      description: `MOTM Individuals — ${team.team_name} participant place`,
      metadata: { payment_type: "individual_team_membership", membership_id: membershipId, individual_team_id: team.id, user_id: user.id }
    }, { idempotencyKey: `motm-individual-membership-${membershipId}` });

    const { error: saveError } = await admin.from("individual_team_memberships")
      .update({ payment_intent_id: intent.id })
      .eq("id", membershipId).eq("user_id", user.id);
    if (saveError) throw new Error(`Could not save payment reference: ${saveError.message}`);

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("Individual membership PaymentIntent error:", error);
    const message = error instanceof Error ? error.message : "Unknown Stripe error";
    return NextResponse.json({ error: `Could not create payment session: ${message}` }, { status: 500 });
  }
}
