"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@/lib/types";

export function EditSessionForm({ session }: { session: Session }) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(session.title);
  const [date, setDate] = useState(session.match_date);
  const [start, setStart] = useState(session.start_time.slice(0, 5));
  const [end, setEnd] = useState(session.end_time.slice(0, 5));
  const [venue, setVenue] = useState(session.venue);
  const [format, setFormat] = useState(session.format);
  const [playersPerTeam, setPlayersPerTeam] = useState(String(session.players_per_team));
  const [maxTeams, setMaxTeams] = useState(String(session.max_teams));
  const [deposit, setDeposit] = useState(String(session.deposit_amount));
  const [description, setDescription] = useState(session.description ?? "");
  const [status, setStatus] = useState(session.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("sessions")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        match_date: date,
        start_time: start,
        end_time: end,
        venue: venue.trim(),
        format,
        players_per_team: Number(playersPerTeam),
        max_teams: Number(maxTeams),
        deposit_amount: Number(deposit),
        status
      })
      .eq("id", session.id);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/organizer");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Session title" value={title} setValue={setTitle} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Date" value={date} setValue={setDate} type="date" />
        <Field label="Venue" value={venue} setValue={setVenue} />
        <Field label="Start time" value={start} setValue={setStart} type="time" />
        <Field label="End time" value={end} setValue={setEnd} type="time" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Select
          label="Format"
          value={format}
          setValue={setFormat}
          options={["7-a-side", "11-a-side"]}
        />
        <Select
          label="Session status"
          value={status}
          setValue={(value) => setStatus(value as Session["status"])}
          options={["open", "full", "ongoing", "completed", "cancelled"]}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Players / team" value={playersPerTeam} setValue={setPlayersPerTeam} type="number" />
        <Field label="Number of teams" value={maxTeams} setValue={setMaxTeams} type="number" />
        <Field label="Deposit (RM)" value={deposit} setValue={setDeposit} type="number" />
      </div>

      <label className="block">
        <span className="mb-2 block text-sm text-zinc-300">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]"
        />
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-[#ffcf27] px-4 py-3 font-semibold text-black hover:bg-[#ffe477] disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  setValue,
  type = "text"
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}</span>
      <input
        required
        type={type}
        value={value}
        min={type === "number" ? 1 : undefined}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]"
      />
    </label>
  );
}

function Select({
  label,
  value,
  setValue,
  options
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
