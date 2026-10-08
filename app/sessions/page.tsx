import { SessionCard } from "@/components/session-card";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/types";

export default async function SessionsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "open")
    .order("match_date", { ascending: true });

  const sessions = (data ?? []) as Session[];

  const sessionCounts = await Promise.all(
    sessions.map(async (session) => {
      const { count } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id)
        .neq("registration_status", "cancelled");

      return [session.id, count ?? 0] as const;
    })
  );

  const counts = new Map(sessionCounts);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div>
        <p className="font-semibold text-green-400">FOOTBALL SESSIONS</p>
        <h1 className="mt-2 text-4xl font-black">Find a game</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Browse open sessions and register your team as captain.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
          No open sessions yet. An organizer can create the first one.
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              teamCount={counts.get(session.id) ?? 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}
