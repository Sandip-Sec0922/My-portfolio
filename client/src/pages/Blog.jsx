import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useApi, usePageTitle } from "../hooks.js";
import Markdown from "../components/Markdown.jsx";
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function BlogList() {
  usePageTitle("Write-ups");
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  // URLSearchParams encodes values, so user input can't inject extra query parameters.
  const qs = new URLSearchParams(
    Object.fromEntries(
      [...sp].filter(
        ([k, v]) => ["q", "tag", "category", "page"].includes(k) && v,
      ),
    ),
  ).toString();
  const { data, loading, error } = useApi(`/posts${qs ? `?${qs}` : ""}`);
  const set = (patch) =>
    setSp({ ...Object.fromEntries(sp), page: "1", ...patch });

  return (
    <section aria-labelledby="blog">
      <h1 id="blog" className="mb-4 text-3xl">
        Write-ups
      </h1>
      <form
        role="search"
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim().length >= 2 ? q.trim() : "" });
        }}
      >
        <label htmlFor="q" className="sr-only">
          Search posts
        </label>
        <input
          id="q"
          className="input"
          value={q}
          maxLength={80}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (min 2 characters)"
        />
        <button className="btn btn-solid">Search</button>
      </form>
      {(sp.get("tag") || sp.get("q")) && (
        <button
          className="btn mb-4"
          onClick={() => {
            setQ("");
            setSp({});
          }}
        >
          Clear filters
        </button>
      )}
      {loading && <p>Loading…</p>}
      {error && <p role="alert">Could not load posts.</p>}
      {data &&
        (data.items.length === 0 ? (
          <p>No posts found.</p>
        ) : (
          <ul className="space-y-4">
            {data.items.map((p) => (
              <li key={p._id} className="glass">
                <h2 className="text-xl">
                  <Link
                    className="accent hover:underline"
                    to={`/blog/${p.slug}`}
                  >
                    {p.title}
                  </Link>
                </h2>
                <p className="font-mono text-xs">
                  {fmt(p.publishedAt)} · {p.category}
                </p>
                <p className="mt-2 text-sm">{p.excerpt}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <li key={t}>
                      <button className="tag" onClick={() => set({ tag: t })}>
                        #{t}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ))}
      {data && data.pages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button
            className="btn"
            disabled={data.page <= 1}
            onClick={() =>
              setSp({ ...Object.fromEntries(sp), page: String(data.page - 1) })
            }
          >
            Prev
          </button>
          <span className="font-mono text-sm">
            {data.page} / {data.pages}
          </span>
          <button
            className="btn"
            disabled={data.page >= data.pages}
            onClick={() =>
              setSp({ ...Object.fromEntries(sp), page: String(data.page + 1) })
            }
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/posts/${encodeURIComponent(slug)}`);
  usePageTitle(data?.title || "Write-up");
  if (loading) return <p>Loading…</p>;
  if (error)
    return (
      <div className="glass" role="alert">
        Post not found.{" "}
        <Link className="accent underline" to="/blog">
          Back to write-ups
        </Link>
      </div>
    );
  return (
    <article>
      <Link className="accent underline" to="/blog">
        ← All write-ups
      </Link>
      <h1 className="mt-3 text-3xl">{data.title}</h1>
      <p className="font-mono text-xs">
        {fmt(data.publishedAt)} · {data.category}
      </p>
      {/* SAFE MARKDOWN: react-markdown never renders raw HTML (no rehype-raw), strips javascript: URLs,
          and builds React elements rather than strings, so a post cannot inject script even if the admin
          account were compromised. Images are also blocked by the CSP (img-src 'self'). */}
      <div className="mt-6">
        <Markdown>{data.content}</Markdown>
      </div>
    </article>
  );
}
