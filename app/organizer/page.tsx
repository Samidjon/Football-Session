import Link from "next/link";
import { SessionActions } from "@/components/session-actions";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OrganizerPage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "organizer") {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">Organizer access only</h1>
        <p className="mt-2 text-zinc-400">
          Promote your account to organizer in Supabase to use this page.
        </p>
      </main>
    );
  }

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("created_by", user.id)
    .order("match_date", { ascending: true });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-[#ffcf27]">ORGANIZER</p>
          <h1 className="mt-2 text-4xl font-black">Your sessions</h1>
          <p className="mt-2 text-zinc-400">
            Create and manage football sessions.
          </p>
        </div>

        <Link
          href="/organizer/sessions/new"
          className="rounded-xl bg-[#ffcf27] px-5 py-3 font-semibold text-black hover:bg-[#ffe477]"
        >
          Create session
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {(sessions ?? []).map((session) => (
          <div
            key={session.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[#ffcf27]">{session.format}</p>
                <h2 className="mt-1 text-xl font-bold">{session.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {session.match_date} • {session.venue}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/sessions/${session.id}`}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
                >
                  View
                </Link>
                <Link
                  href={`/organizer/sessions/${session.id}/edit`}
                  className="rounded-xl border border-[#ffcf27]/30 px-4 py-2 text-sm text-[#ffcf27] hover:bg-[#ffcf27]/10"
                >
                  Edit
                </Link>
                <SessionActions sessionId={session.id} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
