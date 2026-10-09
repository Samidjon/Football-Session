"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function IndividualSettingsForm({ initialDeposit }: { initialDeposit: number }) {
  const [deposit, setDeposit] = useState(String(initialDeposit));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const { error } = await supabase.rpc("update_individual_deposit", { p_deposit_amount: Number(deposit) });
    setBusy(false);
    if (error) return setError(error.message);
    setMessage("Individual deposit updated. New teams will use this amount; existing teams keep their original deposit.");
    router.refresh();
  }

  return <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"><h2 className="text-xl font-bold">Individual team deposit</h2><p className="mt-2 text-sm leading-6 text-zinc-400">This amount applies to teams created after you save. Existing teams keep the deposit amount they were created with.</p><label className="mt-5 block"><span className="mb-2 block text-sm text-zinc-300">Deposit amount (RM)</span><input required min="0.01" step="0.01" type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]" /></label>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}{message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}<button disabled={busy} className="mt-5 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] disabled:opacity-50">{busy ? "Saving..." : "Save deposit"}</button></form>;
}
