import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import { usePageTitle } from "../hooks.js";
import { useAuth } from "./auth.jsx";

export default function MessagesAdmin() {
  usePageTitle("Admin: messages");
  const { fail } = useAuth();
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setData(
        await api.get(
          `/admin/messages?page=${page}${unread ? "&unread=true" : ""}`,
        ),
      );
      setErr("");
    } catch (e) {
      setErr(fail(e));
    }
  }, [page, unread, fail]);
  useEffect(() => {
    load();
  }, [load]);

  async function markRead(m) {
    try {
      await api.patch(`/admin/messages/${m._id}/read`);
      setData((d) => ({
        ...d,
        items: d.items.map((x) => (x._id === m._id ? { ...x, read: true } : x)),
      }));
    } catch (e) {
      setErr(fail(e));
    }
  }

  async function remove(m) {
    if (!window.confirm("Delete this message permanently?")) return;
    try {
      await api.del(`/admin/messages/${m._id}`);
      if (data.items.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setErr(fail(e));
    }
  }

  return (
    <section aria-labelledby="ml">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 id="ml" className="text-2xl">
          Messages{data ? ` (${data.total})` : ""}
        </h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Unread only
        </label>
      </div>
      <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">
        {err}
      </p>
      {!data ? (
        <p>Loading…</p>
      ) : data.items.length === 0 ? (
        <p>No messages.</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m._id} className="glass">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {m.subject}
                    {!m.read && <span className="tag ml-2">new</span>}
                  </p>
                  <p className="font-mono text-xs">
                    {m.name} · {m.email} ·{" "}
                    {new Date(m.createdAt)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}{" "}
                    UTC · IP {m.ip || "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    className="btn btn-sm"
                    href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}
                  >
                    Reply
                  </a>
                  {!m.read && (
                    <button className="btn btn-sm" onClick={() => markRead(m)}>
                      Mark read
                    </button>
                  )}
                  <button className="btn-danger" onClick={() => remove(m)}>
                    Delete
                  </button>
                </div>
              </div>
              {/* Rendered as text by React: visitor input can never become markup. */}
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                {m.message}
              </p>
            </li>
          ))}
        </ul>
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
