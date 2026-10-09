"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { translateValue } from "@/lib/i18n/translations";

type Language = "ms" | "en";

type TextState = { source: string; last: string };
type AttributeState = { source: string; last: string };

type TranslationRoot = HTMLElement & {
  __motmTextState?: WeakMap<Text, TextState>;
  __motmAttrState?: WeakMap<Element, Map<string, AttributeState>>;
  __motmTranslating?: boolean;
};

function applyLanguage(nextLanguage: Language) {
  const root = document.documentElement as TranslationRoot;
  if (root.__motmTranslating) return;
  root.__motmTranslating = true;

  if (!root.__motmTextState) root.__motmTextState = new WeakMap();
  if (!root.__motmAttrState) root.__motmAttrState = new WeakMap();

  const textState = root.__motmTextState;
  const attrState = root.__motmAttrState;

  const processText = (node: Text) => {
    const current = node.data;
    const previous = textState.get(node);
    const source = previous && previous.last === current ? previous.source : current;
    const target = translateValue(source, nextLanguage);
    textState.set(node, { source, last: target });
    if (target !== current) node.data = target;
  };

  const processElement = (element: Element) => {
    for (const attribute of ["placeholder", "title", "aria-label", "aria-description"]) {
      const current = element.getAttribute(attribute);
      if (current === null) continue;

      let states = attrState.get(element);
      if (!states) {
        states = new Map();
        attrState.set(element, states);
      }

      const previous = states.get(attribute);
      const source = previous && previous.last === current ? previous.source : current;
      const target = translateValue(source, nextLanguage);
      states.set(attribute, { source, last: target });
      if (target !== current) element.setAttribute(attribute, target);
    }
  };

  const body = document.body;
  if (body) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("script,style,noscript,textarea,code,pre")) continue;
      processText(node as Text);
    }
  }

  document.querySelectorAll("[placeholder], [title], [aria-label], [aria-description]").forEach(processElement);
  root.__motmTranslating = false;
}

export function LanguageToggle() {
  const [language, setLanguage] = useState<Language>("ms");

  useEffect(() => {
    let initial: Language = "ms";
    try {
      initial = window.localStorage.getItem("motm-language") === "en" ? "en" : "ms";
    } catch {
      // Malay is the default when storage is not available.
    }

    setLanguage(initial);
    document.documentElement.lang = initial;
    applyLanguage(initial);

    const observer = new MutationObserver(() => {
      applyLanguage(document.documentElement.lang === "en" ? "en" : "ms");
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "aria-description"]
    });

    return () => observer.disconnect();
  }, []);

  function selectLanguage(next: Language) {
    setLanguage(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem("motm-language", next);
    } catch {
      // Language still changes for this page.
    }
    applyLanguage(next);
  }

  return (
    <div
      role="group"
      aria-label="Language" title="Language selector"
      className="inline-flex h-10 items-center rounded-xl border border-zinc-700 p-1 text-xs font-bold"
    >
      <Languages size={14} className="mx-1 text-zinc-400" />
      <button
        type="button"
        onClick={() => selectLanguage("ms")}
        aria-pressed={language === "ms"}
        className={`h-7 rounded-lg px-2 transition ${language === "ms" ? "bg-[#ffcf27] text-[#101522]" : "text-zinc-300 hover:bg-zinc-800"}`}
      >
        BM
      </button>
      <button
        type="button"
        onClick={() => selectLanguage("en")}
        aria-pressed={language === "en"}
        className={`h-7 rounded-lg px-2 transition ${language === "en" ? "bg-[#ffcf27] text-[#101522]" : "text-zinc-300 hover:bg-zinc-800"}`}
      >
        EN
      </button>
    </div>
  );
}
