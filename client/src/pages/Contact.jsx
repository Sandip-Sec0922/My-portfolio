import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client.js";
import { usePageTitle } from "../hooks.js";
import { profile } from "../data/profile.js";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const empty = { name: "", email: "", subject: "", message: "" };

function Turnstile({ onToken }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let id;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      id = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (window.turnstile) mount();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = mount;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (id !== undefined) window.turnstile?.remove(id);
    };
  }, [onToken]);
  return SITE_KEY ? <div ref={ref} aria-label="Human verification" /> : null;
}

export default function Contact() {
  usePageTitle("Contact");
  const [form, setForm] = useState(empty);
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState({ state: "idle" });
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const onToken = useCallback((value) => setToken(value), []);
  const onChange = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setStatus({ state: "sending" });
    try {
      await api.post("/contact", {
        ...form,
        companyWebsite,
        ...(token && { turnstileToken: token }),
      });
      setForm(empty);
      setCompanyWebsite("");
      setToken("");
      setStatus({ state: "success" });
    } catch (error) {
      const fields = error.details
        ?.map((detail) => `${detail.field}: ${detail.message}`)
        .join("; ");
      setStatus({
        state: "error",
        message:
          error.status === 429
            ? "Too many messages. Please wait a while before trying again."
            : `${error.message}${fields ? ` (${fields})` : ""}`,
      });
    } finally {
      setToken("");
      setTurnstileAttempt((attempt) => attempt + 1);
    }
  }

  const sending = status.state === "sending";
  return (
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
      <section aria-labelledby="contact">
        <div className="page-intro !mb-6">
          <p className="eyebrow">Start a conversation / 06</p>
          <h1 id="contact" className="mt-3 text-4xl sm:text-5xl">Get in touch</h1>
          <p className="mt-4 leading-relaxed">
            Have a question about a project, security learning, or a possible
            collaboration? Send a note using the form.
          </p>
        </div>
        <div className="glass">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Direct contact</p>
          <a className="mt-2 inline-flex break-all text-sm accent hover:underline" href={`mailto:${profile.email}`}>
            {profile.email} ↗
          </a>
          <p className="prose-copy mt-4 text-sm">
            Please avoid including passwords, credentials, or other sensitive information.
          </p>
        </div>
      </section>

      <section aria-label="Contact form">
        {status.state === "success" ? (
          <motion.div
            className="glass flex min-h-80 flex-col items-start justify-center"
            role="status"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-2xl accent" aria-hidden="true">✓</span>
            <p className="eyebrow mt-5">Message sent</p>
            <h2 className="mt-2 text-2xl">Thanks for reaching out.</h2>
            <p className="prose-copy mt-2 text-sm">Your message was submitted successfully.</p>
            <button className="btn mt-6" onClick={() => setStatus({ state: "idle" })}>Send another message</button>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="glass space-y-5" aria-busy={sending}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Name</label>
                <input id="name" name="name" className="input" type="text" required maxLength={80} autoComplete="name" value={form.name} onChange={onChange("name")} />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
                <input id="email" name="email" className="input" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={onChange("email")} />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">Subject</label>
              <input id="subject" name="subject" className="input" type="text" required minLength={3} maxLength={120} value={form.subject} onChange={onChange("subject")} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="message" className="text-sm font-medium">Message</label>
                <span className="font-mono text-[10px] text-slate-500">{form.message.length}/2000</span>
              </div>
              <textarea
                id="message"
                name="message"
                className="input min-h-40 resize-y"
                required
                minLength={10}
                maxLength={2000}
                value={form.message}
                onChange={onChange("message")}
                aria-describedby="message-hint"
              />
              <p id="message-hint" className="mt-1 text-xs text-slate-500">At least 10 characters. Please don’t include sensitive information.</p>
            </div>
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="company-website">Leave this field empty</label>
              <input id="company-website" name="companyWebsite" tabIndex={-1} autoComplete="off" value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} />
            </div>
            <Turnstile key={turnstileAttempt} onToken={onToken} />
            {status.state === "error" && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert">
                {status.message}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <p className="text-xs text-slate-500">Protected by abuse prevention controls.</p>
              <button className="btn btn-solid min-w-36" disabled={sending} aria-busy={sending}>
                {sending ? (
                  <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> Sending…</>
                ) : (
                  <>Send message <span aria-hidden="true">→</span></>
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
