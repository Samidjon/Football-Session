"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateSessionForm() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("21:00");
  const [end, setEnd] = useState("23:00");
  const [venue, setVenue] = useState("");
  const [format, setFormat] = useState("7-a-side");
  const [playersPerTeam, setPlayersPerTeam] = useState("12");
  const [maxTeams, setMaxTeams] = useState("4");
  const [deposit, setDeposit] = useState("200");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        title,
        description: description || null,
        match_date: date,
        start_time: start,
        end_time: end,
        venue,
        format,
        players_per_team: Number(playersPerTeam),
        max_teams: Number(maxTeams),
        deposit_amount: Number(deposit),
        created_by: userData.user.id
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/sessions/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Session title" value={title} setValue={setTitle} placeholder="Wednesday Football" />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Date" value={date} setValue={setDate} type="date" />
        <Field label="Venue" value={venue} setValue={setVenue} placeholder="KL Football Arena" />
        <Field label="Start time" value={start} setValue={setStart} type="time" />
        <Field label="End time" value={end} setValue={setEnd} type="time" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Select label="Format" value={format} setValue={setFormat} options={["7-a-side", "11-a-side"]} />
        <Field label="Players / team" value={playersPerTeam} setValue={setPlayersPerTeam} type="number" />
        <Field label="Number of teams" value={maxTeams} setValue={setMaxTeams} type="number" />
      </div>

      <Field label="Deposit (RM)" value={deposit} setValue={setDeposit} type="number" />

      <label className="block">
        <span className="mb-2 block text-sm text-zinc-300">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Optional session details..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-[#1559ad]"
        />
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-[#ffcf27] px-4 py-3 font-semibold text-black hover:bg-[#ffe477] disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create football session"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  setValue,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}</span>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
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
