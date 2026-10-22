import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request: Request) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY." }, { status: 500 });
    const { teamId, inviteCode } = await request.json();
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    if (typeof inviteCode !== "string" || !/^[A-Z0-9-]{4,12}$/i.test(inviteCode.trim())) {
      return NextResponse.json({ error: "Enter the team room code before continuing." }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to pay for your own place." }, { status: 401 });

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, team_name, registration_status, session_id, sessions(id, title, deposit_amount, players_per_team, max_teams, status, match_date)")
      .eq("id", teamId)
      .maybeSingle();
    if (teamError || !team) return NextResponse.json({ error: teamError?.message ?? "Team not found" }, { status: 404 });

    const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!["open", "full"].includes(session.status)) return NextResponse.json({ error: "This session is no longer accepting registrations." }, { status: 400 });

    const admin = createAdminClient();

    // Recover cleanly if Stripe confirmed payment but the user's browser closed
    // before the success page finalized the database record.
    const { data: existingMembership, error: existingMembershipError } = await admin
      .from("team_memberships")
      .select("id, team_id, user_id, player_name, status, payment_intent_id")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingMembershipError) {
      return NextResponse.json({ error: "Could not load your registration" }, { status: 500 });
    }
    if (existingMembership?.status === "paid") {
      return NextResponse.json({ alreadyPaid: true, redirectTo: `/teams/${teamId}` });
    }

    const { data: membershipId, error: reserveError } = await supabase.rpc("reserve_team_membership_with_code", {
      p_team_id: teamId,
      p_invite_code: inviteCode.trim().toUpperCase(),
    });
    if (reserveError || !membershipId) {
      // A concurrent successful payment may have finalized between our read and
      // the reservation RPC. Return the user to their now-active team safely.
      const { data: refreshedMembership } = await admin
        .from("team_memberships")
        .select("id, status")
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (refreshedMembership?.status === "paid") {
        return NextResponse.json({ alreadyPaid: true, redirectTo: `/teams/${teamId}` });
      }
      return NextResponse.json({ error: reserveError?.message ?? "Could not reserve a place" }, { status: 409 });
    }

    const { data: membership, error: membershipError } = await admin
      .from("team_memberships")
      .select("id, team_id, user_id, player_name, status, payment_intent_id")
      .eq("id", membershipId)
      .eq("user_id", user.id)
      .single();
    if (membershipError || !membership) return NextResponse.json({ error: "Could not load your reserved place" }, { status: 500 });

    if (membership.payment_intent_id) {
      try {
        const previous = await stripe.paymentIntents.retrieve(membership.payment_intent_id);
        if (previous.status === "succeeded") {
          const metadataMatches = previous.metadata?.payment_type === "session_team_member"
            && previous.metadata?.team_id === teamId
            && previous.metadata?.user_id === user.id
            && previous.metadata?.membership_id === membership.id;
          if (!metadataMatches) {
            return NextResponse.json({ error: "The existing payment does not match this registration. Contact the organizer." }, { status: 409 });
          }

          const paidAt = new Date().toISOString();
          const { error: ledgerError } = await admin.from("team_member_payments").upsert({
            membership_id: membership.id,
            team_id: teamId,
            user_id: user.id,
            amount: previous.amount / 100,
            status: "paid",
            payment_reference: previous.id,
            paid_at: paidAt
          }, { onConflict: "membership_id" });
          if (ledgerError) {
            console.error("Payment recovery ledger error:", ledgerError);
            return NextResponse.json({ error: "Payment succeeded but registration recovery failed. Refresh the team page or contact the organizer." }, { status: 500 });
          }
          const { error: memberUpdateError } = await admin.from("team_memberships")
            .update({ status: "paid", paid_at: paidAt, expires_at: null })
            .eq("id", membership.id).eq("user_id", user.id);
          if (memberUpdateError) {
            console.error("Payment recovery membership error:", memberUpdateError);
            return NextResponse.json({ error: "Payment succeeded but the roster is still updating. Refresh the team page." }, { status: 500 });
          }
          await admin.from("teams").update({ registration_status: "confirmed" }).eq("id", teamId).eq("registration_status", "pending_payment");
          return NextResponse.json({ alreadyPaid: true, redirectTo: `/teams/${teamId}` });
        }
        if (["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(previous.status) && previous.client_secret) {
          return NextResponse.json({ clientSecret: previous.client_secret });
        }
      } catch {
        // A stale PaymentIntent is replaced below.
      }
    }

    const amount = Number(session.deposit_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "The organizer must set a per-player fee greater than RM0." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "myr",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email ?? undefined,
      description: `${session.title} — ${team.team_name} / ${membership.player_name}`,
      metadata: {
        payment_type: "session_team_member",
        team_id: team.id,
        session_id: session.id,
        user_id: user.id,
        membership_id: membership.id
      }
    });

    const { error: updateError } = await admin
      .from("team_memberships")
      .update({ payment_intent_id: paymentIntent.id, expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString() })
      .eq("id", membership.id)
      .eq("user_id", user.id)
      .eq("status", "pending_payment");
    if (updateError) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => undefined);
      return NextResponse.json({ error: "Could not link the payment to your reserved place" }, { status: 500 });
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Session member PaymentIntent error:", error);
    const message = error instanceof Error ? error.message : "Unknown Stripe error";
    return NextResponse.json({ error: `Could not create payment session: ${message}` }, { status: 500 });
  }
}
