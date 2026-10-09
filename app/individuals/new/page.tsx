import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateIndividualTeamForm } from "@/components/create-individual-team-form";

export default async function CreateIndividualTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/individuals/new");

  const { data: settings } = await supabase.from("individual_settings").select("deposit_amount").eq("id", 1).maybeSingle();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <Link href="/individuals" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Back to Individuals</Link>
      <div className="mt-7 mb-7"><p className="font-bold text-[#ffcf27]">MOTM INDIVIDUALS</p><h1 className="mt-2 text-4xl font-black">Create your team</h1><p className="mt-3 text-zinc-400">Your public squad page is created immediately. Payment can be made now or later.</p></div>
      <CreateIndividualTeamForm depositAmount={Number(settings?.deposit_amount ?? 50)} />
    </main>
  );
}
