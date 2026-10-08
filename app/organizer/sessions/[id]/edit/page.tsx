import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EditSessionForm } from "@/components/edit-session-form";
import type { Session } from "@/lib/types";

export default async function EditOrganizerSessionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  if (profile?.role !== "organizer") redirect("/dashboard");

  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/organizer"
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Back to organizer
      </Link>

      <div className="mt-6">
        <p className="font-semibold text-green-400">ORGANIZER</p>
        <h1 className="mt-2 text-4xl font-black">Edit session</h1>
        <p className="mt-2 text-zinc-400">
          Update the match details, team limit, deposit or session status.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8">
        <EditSessionForm session={data as Session} />
      </div>
    </main>
  );
}
