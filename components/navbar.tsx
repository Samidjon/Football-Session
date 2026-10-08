import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
    <header className="border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500 text-lg text-black">
            ⚽
          </span>
          <span>Football Session</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
          <Link href="/sessions" className="hover:text-white">
            Sessions
          </Link>
          {user && (
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
          )}
          {user && profile?.role === "organizer" && (
            <Link href="/organizer" className="hover:text-white">
              Organizer
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-zinc-400 sm:inline">
                {profile?.full_name ?? user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
