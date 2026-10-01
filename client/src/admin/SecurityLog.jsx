import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import { usePageTitle } from "../hooks.js";
import { useAuth } from "./auth.jsx";

const TYPES = [
  "failed_login",
  "account_locked",
  "rate_limit_hit",
  "validation_failure",
  "cors_blocked",
  "nosql_injection_blocked",
  "honeypot_triggered",
  "csrf_failure",
  "auth_denied",
  "captcha_failed",
  "refresh_reuse_detected",
  "login_success",
  "logout",
];

export default function SecurityLog() {
  usePageTitle("Admin: security log");
  const { fail } = useAuth();
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setData(
        await api.get(
          `/admin/security-events?page=${page}${type ? `&type=${type}` : ""}`,
        ),
      );
      setErr("");
    } catch (e) {
      setErr(fail(e));
    }
  }, [page, type, fail]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-labelledby="sl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 id="sl" className="text-2xl">
          Security log{data ? ` (${data.total})` : ""}
        </h1>
        <div className="flex items-center gap-2">
          <label htmlFor="type" className="text-sm">
            Type
          </label>
          <select
            id="type"
            className="input !w-auto"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">all</option>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs">
        Stored 30 days, de-duplicated to one entry per IP and type per minute.
        The full stream is in the container JSON logs for your SIEM.
      </p>
      <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">
        {err}
      </p>
      {!data ? (
        <p>Loading…</p>
      ) : data.items.length === 0 ? (
        <p>No events.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="glass w-full min-w-[48rem] text-left text-xs">
            <caption className="sr-only">Security events, newest first</caption>
            <thead>
              <tr className="font-mono">
                {["Time (UTC)", "Type", "IP", "Request", "Details"].map((h) => (
                  <th key={h} scope="col" className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((ev) => (
                <tr key={ev._id} className="align-top">
                  <td className="whitespace-nowrap p-2 font-mono">
                    {new Date(ev.ts)
                      .toISOString()
                      .slice(0, 19)
                      .replace("T", " ")}
                  </td>
                  <td className="p-2 font-mono accent">{ev.type}</td>
                  <td className="p-2 font-mono">{ev.ip || "-"}</td>
                  <td className="break-all p-2 font-mono">
                    {ev.method} {ev.path}
                  </td>
                  <td className="break-all p-2 font-mono">
                    {ev.details ? JSON.stringify(ev.details) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button
            className="btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </button>
          <span className="font-mono text-sm">
            {data.page} / {data.pages}
          </span>
          <button
            className="btn"
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
