import { useApi, usePageTitle } from "../hooks.js";

const CONTROLS = [
  [
    "Edge (Nginx)",
    "TLS 1.2/1.3 only, HSTS, strict CSP, per-IP rate and connection limits, scanner user-agent blocking, hidden version tokens.",
  ],
  [
    "Load balancing",
    "Three API replicas behind least_conn with passive health checks and automatic failover.",
  ],
  [
    "API",
    "Zod validation on every route, NoSQL-injection and parameter-pollution filters, CORS allowlist, signed CSRF tokens.",
  ],
  [
    "Auth",
    "argon2id, 15-minute access JWTs in httpOnly cookies, single-use rotating refresh tokens, Redis logout blacklist, account lockout.",
  ],
  [
    "Caching",
    "Redis cache-aside with invalidation on admin writes. Bounded key space so attackers cannot fill the cache.",
  ],
  [
    "Network and data",
    "Only Nginx is published. MongoDB and Redis sit on an internal Docker network with no internet route.",
  ],
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
  usePageTitle("Security Posture");
  const { data, loading, error } = useApi("/security/posture");
  const max = data ? Math.max(1, ...data.daily.map((d) => d.total)) : 1;
  return (
    <div className="space-y-12">
      <section aria-labelledby="sec">
        <h1 id="sec" className="mb-2 text-3xl">
          Security Posture
        </h1>
        <p className="mb-4">
          This site is built to be inspected. Here is how it is defended.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {CONTROLS.map(([t, d]) => (
            <div key={t} className="glass">
              <dt className="font-mono text-sm accent">{t}</dt>
              <dd className="mt-1 text-sm">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="live">
        <h2 id="live" className="mb-1 text-2xl">
          Blocked events, last 7 days
        </h2>
        <p className="mb-4 text-sm">
          Aggregated counts only. No IP addresses, paths or usernames are
          exposed.
        </p>
        {loading && <p>Loading…</p>}
        {error && <p role="alert">Live data is unavailable right now.</p>}
        {data && (
          <>
            <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(data.totals).map(([k, v]) => (
                <li key={k} className="glass !p-3">
                  <p className="font-mono text-2xl accent">{v}</p>
                  <p className="text-xs">{LABEL[k] || k}</p>
                </li>
              ))}
            </ul>
            <table className="glass w-full text-sm">
              <caption className="sr-only">Blocked events per day</caption>
              <thead>
                <tr className="text-left font-mono">
                  <th scope="col" className="p-2">
                    Date
                  </th>
                  <th scope="col" className="p-2">
                    Events
                  </th>
                  <th scope="col" className="w-1/2 p-2">
                    <span className="sr-only">Chart</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((d) => (
                  <tr key={d.date}>
                    <td className="p-2 font-mono">{d.date}</td>
                    <td className="p-2">{d.total}</td>
                    <td className="p-2" aria-hidden="true">
                      <div
                        className="h-3 rounded bg-cyan-700 dark:bg-cyan-300"
                        style={{ width: `${(d.total / max) * 100}%` }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 font-mono text-xs">
              Served by replica: {data.servedBy}. Reload to watch the load
              balancer rotate.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
