import Link from "next/link";
import { ArrowRight, CalendarDays, ShieldCheck, Users } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-24 md:pt-32">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Football sessions made simple
          </div>

          <h1 className="text-5xl font-black tracking-tight md:text-7xl">
            Create teams.
            <span className="block text-green-400">Fill the slots.</span>
            Play football.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
            A simple platform for organizers and captains to register teams,
            manage player lists, verify deposits, and prepare match fixtures.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/sessions"
              className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-400"
            >
              Browse sessions <ArrowRight size={18} />
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Create captain account
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          <Feature
            icon={<CalendarDays size={22} />}
            title="Sessions"
            description="Publish date, venue, format, number of teams, player limits and deposit."
          />
          <Feature
            icon={<Users size={22} />}
            title="Teams"
            description="Captains register a team and simply type the names of their players."
          />
          <Feature
            icon={<ShieldCheck size={22} />}
            title="Deposits"
            description="Teams stay pending until the organizer verifies the required deposit."
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
        {icon}
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 leading-7 text-zinc-400">{description}</p>
    </div>
  );
}
