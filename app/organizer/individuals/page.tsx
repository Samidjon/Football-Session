import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IndividualSettingsForm } from "@/components/individual-settings-form";

export default async function OrganizerIndividualsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer") redirect("/dashboard");
  const { data: settings } = await supabase.from("individual_settings").select("deposit_amount").eq("id", 1).maybeSingle();
  return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14"><Link href="/organizer" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Organizer dashboard</Link><p className="mt-7 font-bold text-[#ffcf27]">MOTM INDIVIDUALS</p><h1 className="mt-2 text-4xl font-black">Individual settings</h1><p className="mt-3 mb-8 text-zinc-400">Control the default deposit for new public individual teams.</p><IndividualSettingsForm initialDeposit={Number(settings?.deposit_amount ?? 50)} /></main>;
}
