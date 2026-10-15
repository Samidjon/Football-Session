"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; session_id: string; storage_path: string; caption: string | null; created_at: string };

export function SessionPhotos({ sessionId, editable = false }: { sessionId: string; editable?: boolean }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<(Photo & { url: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);

  async function refresh() {
    const { data, error } = await supabase.from("session_photos").select("*").eq("session_id", sessionId).order("created_at", { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setPhotos((data ?? []).map((p: Photo) => ({ ...p, url: supabase.storage.from("session-photos").getPublicUrl(p.storage_path).data.publicUrl })));
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, [sessionId]);

  async function upload(file?: File | null) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image must be smaller than 10 MB."); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in again."); setBusy(false); return; }
    const path = `${sessionId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("session-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setError(uploadError.message); setBusy(false); return; }
    if (editing) {
      const { error: updateError } = await supabase.from("session_photos").update({ storage_path: path, caption: caption.trim() || null }).eq("id", editing.id).eq("session_id", sessionId);
      if (updateError) {
        await supabase.storage.from("session-photos").remove([path]);
        setError(updateError.message); setBusy(false); return;
      }
      await supabase.storage.from("session-photos").remove([editing.storage_path]);
    } else {
      const { error: insertError } = await supabase.from("session_photos").insert({ session_id: sessionId, storage_path: path, caption: caption.trim() || null, uploaded_by: user.id });
      if (insertError) {
        await supabase.storage.from("session-photos").remove([path]);
        setError(insertError.message); setBusy(false); return;
      }
    }
    setCaption(""); setSelectedFile(null); setEditing(null); await refresh(); setBusy(false);
  }

  async function remove(photo: Photo) {
    if (!window.confirm("Delete this session photo?")) return;
    setBusy(true); setError("");
    const { error: dbError } = await supabase.from("session_photos").delete().eq("id", photo.id).eq("session_id", sessionId);
    if (dbError) { setError(dbError.message); setBusy(false); return; }
    await supabase.storage.from("session-photos").remove([photo.storage_path]);
    await refresh(); setBusy(false);
  }

  return <section id="session-photo-top" className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf27]">Session gallery</p><h2 className="mt-1 text-2xl font-black">Photos <span className="text-base font-semibold text-zinc-500">({photos.length})</span></h2><p className="mt-1 text-sm text-zinc-400">{editable ? "Add photos now or come back later to manage them." : "Moments from this session."}</p></div></div>
    {editable && <div className="mt-5 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4">
      {editing && <div className="mb-3 flex items-center justify-between text-sm text-zinc-300"><span>Replacing photo · optional caption</span><button type="button" onClick={() => { setEditing(null); setCaption(""); setSelectedFile(null); }} className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"><X size={15}/> Cancel</button></div>}
      <label className="block text-sm text-zinc-300">{editing ? "Choose replacement image" : "Choose image"}<input key={editing?.id ?? "new"} type="file" accept="image/*" disabled={busy} onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ffcf27] file:px-4 file:py-2 file:font-bold file:text-black disabled:opacity-50" /></label>
      <label className="mt-3 block text-sm text-zinc-300">Caption (optional)<input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={160} placeholder="e.g. Team photo after the match" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-[#ffcf27]" /></label>
      {busy && <p className="mt-3 flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle size={16} className="animate-spin"/> Saving photo…</p>}
      <button type="button" disabled={busy || !selectedFile} onClick={() => void upload(selectedFile)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#ffcf27] px-4 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : editing ? "Replace photo" : "Upload photo"}</button>
      <p className="mt-2 text-xs text-zinc-500">JPG, PNG, WebP or another image format · max 10 MB per photo.</p>
    </div>}
    {error && <p role="alert" className="mt-3 break-words text-sm text-red-300">{error}</p>}
    {loading ? <p className="mt-5 text-sm text-zinc-500">Loading photos…</p> : photos.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-zinc-800 p-7 text-center"><ImagePlus className="mx-auto text-zinc-600" size={28}/><p className="mt-2 text-sm text-zinc-500">{editable ? "No photos yet. Add the first one above." : "No photos have been added to this session yet."}</p></div> : <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">{photos.map((photo) => <article key={photo.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"><a href={photo.url} target="_blank" rel="noreferrer" className="block"><div className="relative aspect-[4/3]"><Image src={photo.url} alt={photo.caption || "Session photo"} fill unoptimized className="object-cover transition duration-300 hover:scale-[1.02]" sizes="(max-width: 640px) 100vw, 50vw" /></div></a><div className="flex items-center justify-between gap-3 p-3"><p className="min-w-0 break-words text-sm text-zinc-300">{photo.caption || "Session photo"}</p>{editable && <div className="flex shrink-0 gap-2"><button type="button" disabled={busy} title="Replace photo" onClick={() => { setEditing(photo); setCaption(photo.caption ?? ""); setSelectedFile(null); document.getElementById("session-photo-top")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:border-[#ffcf27] hover:text-[#ffcf27]"><Pencil size={15}/></button><button type="button" disabled={busy} title="Delete photo" onClick={() => void remove(photo)} className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:border-red-500 hover:text-red-300"><Trash2 size={15}/></button></div>}</div></article>)}</div>}
  </section>;
}
