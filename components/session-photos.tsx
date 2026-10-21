"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, Link2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Photo = {
  id: string;
  session_id: string;
  storage_path: string | null;
  image_url: string | null;
  caption: string | null;
  created_at: string;
};
type DisplayPhoto = Photo & { url: string };

export function SessionPhotos({ sessionId, editable = false }: { sessionId: string; editable?: boolean }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");

  async function refresh() {
    const { data, error: readError } = await supabase.from("session_photos").select("*")
      .eq("session_id", sessionId).order("created_at", { ascending: false });
    if (readError) {
      setError(readError.message);
      setLoading(false);
      return;
    }
    const formatted = (data ?? []).map((photo: Photo) => {
      const url = photo.image_url || (photo.storage_path
        ? supabase.storage.from("session-photos").getPublicUrl(photo.storage_path).data.publicUrl
        : "");
      return { ...photo, url };
    }).filter((photo: DisplayPhoto) => Boolean(photo.url));
    setPhotos(formatted);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, [sessionId]);

  async function addImageLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || busy) return;
    setError("");

    let parsed: URL;
    try {
      parsed = new URL(imageUrl.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Invalid protocol");
    } catch {
      setError("Enter a valid direct image URL starting with https:// or http://.");
      return;
    }

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again.");
      setBusy(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "organizer") {
      setError("Only an administrator can add image links.");
      setBusy(false);
      return;
    }

    const { error: insertError } = await supabase.from("session_photos").insert({
      session_id: sessionId,
      storage_path: null,
      image_url: parsed.href,
      caption: caption.trim() || null,
      uploaded_by: user.id
    });
    if (insertError) {
      setError(insertError.message);
      setBusy(false);
      return;
    }

    setImageUrl("");
    setCaption("");
    await refresh();
    setBusy(false);
  }

  async function remove(photo: DisplayPhoto) {
    if (!editable || !window.confirm("Remove this image link from the session?")) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.from("session_photos").delete().eq("id", photo.id).eq("session_id", sessionId);
    if (deleteError) {
      setError(deleteError.message);
      setBusy(false);
      return;
    }
    if (photo.storage_path) await supabase.storage.from("session-photos").remove([photo.storage_path]);
    await refresh();
    setBusy(false);
  }

  return (
    <section id="session-photo-top" className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">MOTM · SESSION GALLERY</p>
          <h2 className="mt-1 text-2xl font-black">Session images <span className="text-base font-semibold text-zinc-500">({photos.length})</span></h2>
          <p className="mt-1 text-sm text-zinc-400">Remember to tag MOTM when you share your football moments.</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-[#e5dfcb] bg-[#fffdf2]">
        <Image src="/upload-loading-soccer-field.webp" alt="MOTM mascot reminding players to tag MOTM on social media"
          width={640} height={427} sizes="(max-width: 768px) 100vw, 1100px"
          className="mx-auto h-auto w-full max-w-5xl object-contain" priority={false} />
      </div>

      {editable && (
        <form onSubmit={addImageLink} className="mt-5 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4">
          <div className="mb-3">
            <p className="flex items-center gap-2 text-sm font-bold"><Link2 size={16} /> Add an image by URL</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Administrator only. Paste a direct link to an image; no file upload is needed.</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-300">Image URL</span>
            <input type="url" required value={imageUrl} onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/motm-session.jpg" disabled={busy}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-[#ffcf27] disabled:opacity-50" />
          </label>
          <label className="mt-3 block">
            <span className="mb-2 block text-sm text-zinc-300">Caption (optional)</span>
            <input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={160}
              placeholder="e.g. Match highlights" disabled={busy}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-[#ffcf27] disabled:opacity-50" />
          </label>
          {error && <p role="alert" className="mt-3 break-words text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={busy || !imageUrl.trim()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#ffcf27] px-4 py-2.5 text-sm font-bold text-[#101522] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <><LoaderCircle size={16} className="animate-spin" /> Saving…</> : <><ImagePlus size={16} /> Add image link</>}
          </button>
        </form>
      )}

      {!editable && error && <p role="alert" className="mt-3 break-words text-sm text-red-300">{error}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-zinc-500">Loading images…</p>
      ) : photos.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-800 p-7 text-center">
          <ImagePlus className="mx-auto text-zinc-600" size={28} />
          <p className="mt-2 text-sm text-zinc-500">{editable ? "No extra images yet. Add a URL above." : "No extra images have been added to this session yet."}</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-[4/3]">
                  <Image src={photo.url} alt={photo.caption || "MOTM session image"} fill unoptimized
                    className="object-cover transition duration-300 hover:scale-[1.02]" sizes="(max-width: 640px) 100vw, 50vw" />
                </div>
              </a>
              <div className="flex items-center justify-between gap-3 p-3">
                <p className="min-w-0 break-words text-sm text-zinc-300">{photo.caption || "Session image"}</p>
                {editable && <button type="button" disabled={busy} title="Remove image link" aria-label="Remove image link"
                  onClick={() => void remove(photo)}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:border-red-500 hover:text-red-300 disabled:opacity-50"><Trash2 size={15} /></button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
