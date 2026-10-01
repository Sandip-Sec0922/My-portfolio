import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { usePageTitle } from "../hooks.js";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY; // public by design

function Turnstile({ onToken }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let id;
    const mount = () => {
      id = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (window.turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      if (id !== undefined) window.turnstile?.remove(id);
    };
  }, [onToken]);
  return SITE_KEY ? <div ref={ref} /> : null;
}

const empty = { name: "", email: "", subject: "", message: "" };

export default function Contact() {
  usePageTitle("Contact");
  const [f, setF] = useState(empty);
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState("");
  const [status, setStatus] = useState({ s: "idle" });
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus({ s: "sending" });
    try {
      await api.post("/contact", {
        ...f,
        website,
        ...(token && { turnstileToken: token }),
      });
      setF(empty);
      setStatus({ s: "ok" });
    } catch (err) {
      const fields = err.details
        ?.map((d) => `${d.field}: ${d.message}`)
        .join("; ");
      setStatus({
        s: "error",
        msg:
          err.status === 429
            ? "Too many messages. Please try again later."
            : `${err.message}${fields ? ` (${fields})` : ""}`,
      });
    }
  }

  return (
    <section aria-labelledby="contact" className="max-w-xl">
      <h1 id="contact" className="mb-4 text-3xl">
        Contact
      </h1>
      <form onSubmit={submit} className="glass space-y-4">
        {[
          ["name", "Name", "text", 80],
          ["email", "Email", "email", 254],
          ["subject", "Subject", "text", 120],
        ].map(([k, label, type, max]) => (
          <div key={k}>
            <label htmlFor={k} className="mb-1 block text-sm">
              {label}
            </label>
            <input
              id={k}
              type={type}
              required
              maxLength={max}
              className="input"
              value={f[k]}
              onChange={on(k)}
              autoComplete={
                k === "name" ? "name" : k === "email" ? "email" : "off"
              }
            />
          </div>
        ))}
        <div>
          <label htmlFor="message" className="mb-1 block text-sm">
            Message (10–2000 characters)
          </label>
          <textarea
            id="message"
            required
            minLength={10}
            maxLength={2000}
            rows={6}
            className="input"
            value={f.message}
            onChange={on("message")}
          />
        </div>
        {/* Honeypot: invisible to people and assistive tech, bots fill it. */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">Leave empty</label>
          <input
            id="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <Turnstile onToken={setToken} />
        <button className="btn btn-solid" disabled={status.s === "sending"}>
          {status.s === "sending" ? "Sending…" : "Send message"}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {status.s === "ok" && "Thanks! Your message was sent."}
          {status.s === "error" && (
            <span className="text-red-700 dark:text-red-300">{status.msg}</span>
          )}
        </p>
      </form>
    </section>
  );
}
