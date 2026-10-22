"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TeamJoinCodeGate({ teamId }: { teamId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,12}$/.test(normalized)) {
      setError("Enter a valid room code (4–12 letters, numbers, or hyphens).");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: verifyError } = await supabase.rpc("verify_team_invite_code", {
      p_team_id: teamId,
      p_invite_code: normalized,
    });
    if (verifyError || data !== true) {
      setError("That room code is incorrect. Ask the captain for the correct code.");
      setLoading(false);
      return;
    }
    try {
      window.sessionStorage.setItem(`motm-team-room-code:${teamId}`, normalized);
      router.push(`/teams/${teamId}/payment`);
    } catch {
      setError("Your browser could not store the verified code. Please allow session storage and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-[#ffcf27] px-5 py-3 text-sm font-black text-[#101522] shadow-[0_8px_30px_rgba(255,207,39,0.12)] transition hover:-translate-y-0.5 hover:bg-[#ffe477]">Join Team</button>
      ) : (
        <form onSubmit={continueToPayment} className="mt-2 w-full min-w-0 rounded-2xl border border-[#ffcf27]/25 bg-[#ffcf27]/5 p-4 sm:min-w-80">
          <div className="flex items-center gap-2 text-[#ffcf27]"><LockKeyhole size={17} /><p className="text-sm font-black">Enter room code to join</p></div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Ask the team captain for the private code. You’ll continue to payment after it’s verified.</p>
          <label className="mt-3 block"><span className="sr-only">Team room code</span><span className="relative block"><KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} /><input autoFocus required minLength={4} maxLength={12} pattern="[A-Za-z0-9-]{4,12}" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12))} placeholder="Enter code" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-9 pr-3 font-bold tracking-wider outline-none focus:border-[#ffcf27]" /></span></label>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-3 flex gap-2"><button type="button" onClick={() => { setOpen(false); setError(""); }} className="rounded-xl border border-zinc-700 px-3 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">Cancel</button><button type="submit" disabled={loading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ffcf27] px-3 py-2.5 text-sm font-black text-[#101522] disabled:opacity-50">{loading ? "Checking…" : "Continue"} <ArrowRight size={15} /></button></div>
        </form>
      )}
    </div>
  );
}
