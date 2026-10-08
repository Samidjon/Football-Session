"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteTeamButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete your team from this session? This will remove the player list too."
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    const { error } = await supabase.rpc("delete_team", {
      p_team_id: teamId
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-xl border border-red-900 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Delete team"}
      </button>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
