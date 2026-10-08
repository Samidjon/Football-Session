"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SessionActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function deleteSession() {
    const confirmed = window.confirm(
      "Delete this session? This will also remove its teams, players, payments and fixtures."
    );

    if (!confirmed) return;

    setLoading(true);

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      window.alert(error.message);
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={deleteSession}
        disabled={loading}
        className="rounded-xl border border-red-900 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
