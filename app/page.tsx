import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, ShieldCheck, Users } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-6 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ffcf27]/25 bg-[#ffcf27]/10 px-4 py-2 text-sm font-semibold text-[#ffcf27]">
              <span className="h-2 w-2 rounded-full bg-[#ffcf27] shadow-[0_0_12px_rgba(255,207,39,0.7)]" />
              The home of MOTM football
            </div>

            <h1 className="text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl md:text-7xl">
              Your team.
              <span className="block text-[#ffcf27]">Your game.</span>
              Your moment.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
              Discover upcoming football sessions, register your team, manage your squad, and secure your place on the pitch.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/sessions"
                className="inline-flex items-center gap-2 rounded-xl bg-[#ffcf27] px-5 py-3 font-bold text-[#101522] transition hover:bg-[#ffe477]"
              >
                Browse sessions <ArrowRight size={18} />
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:border-[#ffcf27]/60 hover:bg-zinc-900"
              >
                Become a captain
              </Link>
              <Link
                href="/individuals"
                className="rounded-xl border border-[#ffcf27]/35 px-5 py-3 font-semibold text-[#ffcf27] transition hover:bg-[#ffcf27]/10"
              >
                Explore Individuals
              </Link>
            </div>

            <a
              href="https://www.instagram.com/maluohtapimahu/"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-[#ffcf27]"
            >
              Follow MOTM on Instagram <span className="font-semibold text-[#ffcf27]">@maluohtapimahu</span>
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-blue-600/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-[#ffcf27]/25 bg-gradient-to-br from-[#1559ad] via-[#104b97] to-[#071b38] p-7 shadow-[0_25px_100px_rgba(10,77,164,0.22)] sm:p-10">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border-[24px] border-[#ffcf27]/15" />
              <div className="relative mx-auto aspect-square w-full max-w-[270px] overflow-hidden rounded-3xl bg-white p-2 shadow-2xl shadow-black/30">
                <Image
                  src="/motm-logo.jpg"
                  alt="MOTM football emblem"
                  width={400}
                  height={400}
                  priority
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="relative mt-6 text-center">
                <p className="text-3xl font-black tracking-[0.12em] text-white">MOTM</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.28em] text-[#ffcf27]">Football Community</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          <Feature
            icon={<CalendarDays size={22} />}
            title="Find your session"
            description="Browse match dates, venues, formats, available team slots and deposits."
          />
          <Feature
            icon={<Users size={22} />}
            title="Bring your squad"
            description="Captains register a team and manage player names in one place."
          />
          <Feature
            icon={<ShieldCheck size={22} />}
            title="Secure your spot"
            description="Track deposit status and keep your team registration organized."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur transition hover:border-[#ffcf27]/30">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffcf27]/10 text-[#ffcf27]">
        {icon}
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 leading-7 text-zinc-400">{description}</p>
    </div>
  );
}
