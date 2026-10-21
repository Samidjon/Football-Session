import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CreateIndividualPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/individuals/new");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "organizer") redirect("/individuals");

  // Session creation uses the existing, server-protected admin workflow.
  redirect("/organizer/sessions/new");
}
