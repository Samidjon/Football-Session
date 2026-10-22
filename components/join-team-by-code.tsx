"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function JoinTeamByCode() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,12}$/.test(normalized)) {
      setError("Enter a code containing 4–12 letters, numbers, or hyphens.");
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: lookupError } = await supabase.rpc("find_team_by_invite_code", {
      p_invite_code: normalized,
    });

    if (lookupError || !data) {
      setError("We couldn't find an active team with that code. Check it and try again.");
      setLoading(false);
      return;
    }

    router.push(`/teams/${data}`);
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/65 p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ffcf27]/10 text-[#ffcf27]">
          <KeyRound size={23} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Have an invite code?</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Join your captain’s team</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Enter the code your captain shared with you to open the correct team and reserve your place.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Team invitation code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12))}
            minLength={4}
            maxLength={12}
            pattern="[A-Z0-9-]{4,12}"
            required
            autoComplete="off"
            placeholder="E.g. MOTM-26"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 font-bold tracking-[0.12em] text-white outline-none transition placeholder:font-normal placeholder:tracking-normal focus:border-[#ffcf27]"
          />
        </label>
        <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3.5 font-black text-[#101522] transition hover:bg-[#ffe477] disabled:opacity-50">
          {loading ? "Checking code..." : "Find team"} <ArrowRight size={17} />
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <p className="mt-3 text-xs text-zinc-500">Joining and payments happen on the team page. Only completed payments are added to the player list.</p>
    </div>
  );
}
