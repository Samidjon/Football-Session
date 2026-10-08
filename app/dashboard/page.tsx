import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, team_name, registration_status, session_id, sessions(title, match_date)")
    .eq("captain_id", user.id)
    .neq("registration_status", "cancelled")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-green-400">CAPTAIN DASHBOARD</p>
          <h1 className="mt-2 text-4xl font-black">
            Welcome, {profile?.full_name ?? "Captain"} 👋
          </h1>
          <p className="mt-2 text-zinc-400">
            Manage your football teams and registrations.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/sessions" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
            Browse sessions
          </Link>
          {profile?.role === "organizer" && (
            <Link href="/organizer" className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">
              Organizer
            </Link>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Stat title="My teams" value={String(teams?.length ?? 0)} />
        <Stat
          title="Confirmed"
          value={String(
            (teams ?? []).filter((team) => team.registration_status === "confirmed").length
          )}
        />
        <Stat
          title="Pending payments"
          value={String(
            (teams ?? []).filter((team) => team.registration_status === "pending_payment").length
          )}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">My teams</h2>

        {(teams?.length ?? 0) === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-8 text-zinc-500">
            You have no teams yet. Browse sessions and register one.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {teams?.map((team) => {
              const session = Array.isArray(team.sessions) ? team.sessions[0] : team.sessions;
              return (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 transition hover:border-green-500/40"
                >
                  <p className="text-sm text-green-400">{session?.title ?? "Football session"}</p>
                  <h3 className="mt-2 text-xl font-bold">{team.team_name}</h3>
                  <p className="mt-3 text-sm text-zinc-400">
                    {team.registration_status === "confirmed"
                      ? "🟢 Confirmed"
                      : "🟡 Pending payment"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}
