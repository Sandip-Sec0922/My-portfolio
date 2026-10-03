import { motion } from "framer-motion";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { useApi, usePageTitle } from "../hooks.js";

const CONTROLS = [
  ["Request routing", "The frontend sends API requests through a same-origin route, keeping browser authentication cookies scoped to the site."],
  ["API validation", "Request schemas, NoSQL sanitization, parameter-pollution protection, and explicit CORS allowlisting."],
  ["Authentication", "Argon2 password hashing, short-lived access tokens, rotating refresh tokens, and CSRF protection."],
  ["Abuse controls", "IP-based rate limits, per-account-and-IP login backoff, a contact honeypot, and server-verified Turnstile challenges."],
  ["Caching", "Redis cache-aside for public data with invalidation after administrative changes."],
  ["Data protection", "Admin-only access to messages and security events, bounded request sizes, and automatic data-retention limits."],
];

const LABEL = {
  failed_login: "Failed logins",
  account_locked: "Account lockouts",
  rate_limit_hit: "Rate-limit hits",
  validation_failure: "Validation failures",
  cors_blocked: "CORS blocks",
  nosql_injection_blocked: "NoSQL injection blocked",
  honeypot_triggered: "Honeypot triggers",
  csrf_failure: "CSRF failures",
  auth_denied: "Auth denied",
  captcha_failed: "CAPTCHA failures",
};

export default function Security() {
  usePageTitle(
    "Security Posture",
    "An overview of the security controls and aggregate security-event telemetry used by Sandip Kepchhaki's portfolio.",
  );
  const { data, loading, error } = useApi("/security/posture");
  const max = data ? Math.max(1, ...data.daily.map((day) => day.total)) : 1;
  return (
    <div className="space-y-14">
      <section aria-labelledby="sec">
        <div className="page-intro">
          <p className="eyebrow">System overview / 05</p>
          <h1 id="sec" className="mt-3 text-4xl sm:text-5xl">Security posture</h1>
          <p className="mt-3 max-w-2xl leading-relaxed">
            A practical overview of controls implemented in this portfolio platform.
            Aggregate activity below excludes IP addresses, paths, and usernames.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map(([title, description], index) => (
            <motion.div
              key={title}
              className="glass"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.24, delay: index * 0.04 }}
            >
              <dt className="flex items-center gap-2 font-mono text-xs accent">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-[10px]">{String(index + 1).padStart(2, "0")}</span>
                {title}
              </dt>
              <dd className="prose-copy mt-3 text-sm">{description}</dd>
            </motion.div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="live">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Live aggregated telemetry</p>
            <h2 id="live" className="section-title mt-2">Security events · 7 days</h2>
            <p className="prose-copy mt-2 text-sm">Counts only — no IP addresses, paths, or usernames are exposed.</p>
          </div>
          {data && <span className="tag"><span className="status-dot !mr-1.5" />Updated {new Date(data.generatedAt).toLocaleTimeString()}</span>}
        </div>
        {loading && <LoadingSkeleton rows={3} />}
        {error && <p className="glass text-sm" role="alert">Live security data is unavailable right now.</p>}
        {data && (
          <>
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(data.totals).map(([key, value]) => (
                <li key={key} className="glass !p-4">
                  <p className="font-mono text-2xl accent">{value}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{LABEL[key] || key}</p>
                </li>
              ))}
            </ul>
            <div className="glass">
              <h3 className="font-mono text-xs uppercase tracking-wider text-slate-500">Daily event volume</h3>
              <div className="mt-5 space-y-3">
                {data.daily.map((day) => (
                  <div key={day.date} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-xs">
                    <time className="font-mono text-slate-500" dateTime={day.date}>{day.date}</time>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
                      role="img"
                      aria-label={`${day.total} security events on ${day.date}`}
                    >
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-teal-600 to-cyan-400 dark:from-teal-300 dark:to-cyan-200"
                        initial={{ width: 0 }}
                        animate={{ width: `${(day.total / max) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-right font-mono">{day.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
