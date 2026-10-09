import Image from "next/image";
import Link from "next/link";
import { Instagram } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { full_name: string; role: "organizer" | "captain" } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3 font-bold">
          <Image src="/motm-logo.jpg" alt="MOTM football logo" width={48} height={48} priority className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-0.5" />
          <span className="min-w-0">
            <span className="block text-base font-black tracking-wide sm:text-lg">MOTM</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffcf27] sm:text-[11px]">Football Sessions</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-zinc-300 lg:flex">
          <Link href="/sessions" className="transition hover:text-[#ffcf27]">Sessions</Link>
          <Link href="/individuals" className="transition hover:text-[#ffcf27]">Individuals</Link>
          {user && <Link href="/dashboard" className="transition hover:text-[#ffcf27]">Dashboard</Link>}
          {user && profile?.role === "organizer" && <Link href="/organizer" className="transition hover:text-[#ffcf27]">Organizer</Link>}
          <a href="https://www.instagram.com/maluohtapimahu/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-[#ffcf27]" aria-label="MOTM on Instagram">
            <Instagram size={16} /> Instagram
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden max-w-36 truncate text-sm text-zinc-400 xl:inline">{profile?.full_name ?? user.email}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" className="rounded-xl px-2 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white sm:px-3">Login</Link>
              <Link href="/auth/register" className="rounded-xl bg-[#ffcf27] px-3 py-2 text-sm font-bold text-[#101522] transition hover:bg-[#ffe477] sm:px-4">Register</Link>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto px-4 pb-3 text-sm text-zinc-300 lg:hidden sm:px-6">
        <Link href="/sessions" className="whitespace-nowrap hover:text-[#ffcf27]">Sessions</Link>
        <Link href="/individuals" className="whitespace-nowrap hover:text-[#ffcf27]">Individuals</Link>
        {user && <Link href="/dashboard" className="whitespace-nowrap hover:text-[#ffcf27]">Dashboard</Link>}
        {user && profile?.role === "organizer" && <Link href="/organizer" className="whitespace-nowrap hover:text-[#ffcf27]">Organizer</Link>}
      </div>
    </header>
  );
}
