import Link from "next/link";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import type { Session } from "@/lib/types";

export function SessionCard({
  session,
  teamCount
}: {
  session: Session;
  teamCount: number;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 transition hover:border-green-500/40 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-400">
            {session.format}
          </span>
          <h2 className="mt-4 text-2xl font-bold">{session.title}</h2>
        </div>

        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
          {session.deposit_amount === 0
            ? "Free"
            : `RM ${session.deposit_amount.toFixed(0)} deposit`}
        </span>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-zinc-400">
        <Info icon={<CalendarDays size={16} />} text={formatDate(session.match_date)} />
        <Info icon={<Clock3 size={16} />} text={`${session.start_time.slice(0, 5)} – ${session.end_time.slice(0, 5)}`} />
        <Info icon={<MapPin size={16} />} text={session.venue} />
        <Info icon={<Users size={16} />} text={`${teamCount} / ${session.max_teams} teams registered`} />
      </div>

      <Link
        href={`/sessions/${session.id}`}
        className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 font-semibold text-black hover:bg-zinc-200"
      >
        View session
      </Link>
    </article>
  );
}

function Info({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-green-400">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
