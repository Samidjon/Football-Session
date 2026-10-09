"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateIndividualTeamForm({ depositAmount }: { depositAmount: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.rpc("create_individual_team", {
      p_team_name: teamName.trim()
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(`/individuals/teams/${data}/manage`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#ffcf27]">Create an individual team</p>
        <h2 className="mt-2 text-2xl font-black">Build your squad</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Your team and player list will be public. You can add up to 30 players and pay the deposit later. Until the deposit is paid, the team is labelled “Not counted”.</p>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm text-zinc-300">Team name</span>
        <input required minLength={2} maxLength={70} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="MOTM United" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]" />
      </label>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-zinc-400">Required deposit</span>
          <strong className="text-xl">RM {depositAmount.toFixed(2)}</strong>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">You do not have to pay now. The team won't count as active until Stripe confirms the payment.</p>
      </div>
      {error && <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>}
      <button disabled={loading} className="w-full rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477] disabled:opacity-50">{loading ? "Creating team..." : "Create team"}</button>
    </form>
  );
}
