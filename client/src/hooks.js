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

export function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} | Sandip Kepchhaki`;
  }, [title]);
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
