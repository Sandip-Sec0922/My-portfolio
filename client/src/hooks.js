import { useEffect, useState } from "react";
import { api } from "./api/client.js";

export function useApi(path) {
  const [state, set] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    set({ loading: true });
    api
      .get(path)
      .then((data) => live && set({ data }))
      .catch((error) => live && set({ error }));
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}

export function usePageTitle(
  title,
  description = `${title} from Sandip Kepchhaki's security portfolio.`,
) {
  useEffect(() => {
    document.title = `${title} | Sandip Kepchhaki`;
    const canonical = document.querySelector('link[rel="canonical"]');
    const origin = canonical
      ? new URL(canonical.href).origin
      : window.location.origin;
    const url = new URL(window.location.pathname, origin).href;
    const content = {
      description,
      "og:title": document.title,
      "og:description": description,
      "og:url": url,
      "twitter:title": document.title,
      "twitter:description": description,
    };

    Object.entries(content).forEach(([key, value]) => {
      const selector = key.startsWith("og:")
        ? `meta[property="${key}"]`
        : `meta[name="${key}"]`;
      let meta = document.querySelector(selector);
      if (!meta) {
        meta = document.createElement("meta");
        if (key.startsWith("og:")) meta.setAttribute("property", key);
        else meta.name = key;
        document.head.appendChild(meta);
      }
      meta.content = value;
    });

    if (canonical) canonical.href = url;
  }, [title, description]);
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Typing effect. Reduced-motion users get the final text immediately.
export function useTyping(lines, speed = 45) {
  const [out, setOut] = useState(() =>
    prefersReducedMotion() ? lines.join("\n") : "",
  );
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const full = lines.join("\n");
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setOut(full.slice(0, i));
      if (i >= full.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [lines, speed]);
  return out;
}
