import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateSessionForm } from "@/components/create-session-form";

export default async function NewSessionPage() {
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="font-semibold text-green-400">ORGANIZER</p>
      <h1 className="mt-2 text-4xl font-black">Create session</h1>
      <p className="mt-2 text-zinc-400">
        Publish the match details and open the team slots.
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8">
        <CreateSessionForm />
      </div>
    </main>
  );
}
