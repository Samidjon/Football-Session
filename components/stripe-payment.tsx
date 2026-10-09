"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CardElement,
  Elements,
  useElements,
  useStripe
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export function StripePayment({ teamId, mode = "session" }: { teamId: string; mode?: "session" | "individual" }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      try {
        setLoading(true);
        const response = await fetch(mode === "individual" ? "/api/stripe/create-individual-payment-intent" : "/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "individual" ? { individualTeamId: teamId } : { teamId })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not start payment");
        }

        if (!data.clientSecret) {
          throw new Error("Stripe did not return a client secret");
        }

        if (!cancelled) {
          setClientSecret(data.clientSecret);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start payment");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    createIntent();

    return () => {
      cancelled = true;
    };
  }, [teamId, mode]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
        Loading secure payment form...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/40 p-5 text-red-300">
        {error}
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#ffcf27",
            colorBackground: "#09090b",
            colorText: "#f4f4f5",
            colorTextSecondary: "#a1a1aa",
            colorDanger: "#f87171",
            borderRadius: "12px"
          }
        }
      }}
    >
      <PaymentForm />
    </Elements>
  );
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setMessage("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}/success`
      }
    });

    if (error) {
      setMessage(error.message ?? "Payment could not be completed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Payment details</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your card details securely below.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <CardElement
          options={{
            hidePostalCode: false,
            style: {
              base: {
                color: "#f4f4f5",
                fontSize: "16px",
                fontFamily: "Inter, system-ui, sans-serif",
                "::placeholder": { color: "#71717a" }
              },
              invalid: { color: "#f87171" }
            }
          }}
        />
      </div>

      {message && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe || !elements}
        className="w-full rounded-xl bg-[#ffcf27] px-4 py-3 font-semibold text-black hover:bg-[#ffe477] disabled:opacity-50"
      >
        {loading ? "Processing payment..." : "Pay deposit"}
      </button>

      <p className="text-center text-xs leading-5 text-zinc-600">
        Your card details are handled by Stripe and are not stored in the MOTM database.
      </p>
    </form>
  );
}
