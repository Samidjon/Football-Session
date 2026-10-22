"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TeamInviteCodePanel({ teamId }: { teamId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadCode = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_team_invite_code", { p_team_id: teamId });
    if (rpcError || !data) {
      setError("Invite code is unavailable. Make sure the latest database migration has been applied.");
      setLoading(false);
      return;
    }
    setCode(data);
    setLoading(false);
  }, [supabase, teamId]);

  useEffect(() => { void loadCode(); }, [loadCode]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Select and copy the code manually.");
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#ffcf27]/25 bg-[#ffcf27]/5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffcf27]/10 text-[#ffcf27]"><KeyRound size={20} /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffcf27]">Captain tools</p><h2 className="mt-1 text-lg font-black">Your team invite code</h2><p className="mt-1 text-sm leading-6 text-zinc-400">Share this code with your players. They can enter it on the Teams page to find your squad.</p></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="min-w-36 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center font-mono text-xl font-black tracking-[0.16em] text-white">{loading ? "••••••••" : code || "Unavailable"}</div>
        {code && <button type="button" onClick={copyCode} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffcf27] px-4 py-3 text-sm font-black text-[#101522] transition hover:bg-[#ffe477]">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy code"}</button>}
        <button type="button" onClick={() => { void loadCode(); }} aria-label="Reload invite code" className="inline-flex items-center justify-center rounded-xl border border-zinc-700 p-3 text-zinc-300 transition hover:bg-zinc-800"><RefreshCw size={17} /></button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
