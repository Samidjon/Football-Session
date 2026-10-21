"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppShareButton({ message }: { message: string }) {
  const href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Share your team registration on WhatsApp"
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-[#062b16] transition hover:bg-[#35e476] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <MessageCircle size={18} aria-hidden="true" />
      Share on WhatsApp
    </a>
  );
}
