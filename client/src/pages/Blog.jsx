import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { useApi, usePageTitle } from "../hooks.js";
import Markdown from "../components/Markdown.jsx";

const fmt = (date) => (date ? new Date(date).toISOString().slice(0, 10) : "");

export function BlogList() {
  usePageTitle(
    "Security write-ups",
    "Search and read cybersecurity investigations, technical notes, and lessons from Sandip Kepchhaki.",
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  useEffect(() => setQuery(searchParams.get("q") || ""), [searchParams]);

  const qs = new URLSearchParams(
    Object.fromEntries(
      [...searchParams].filter(
        ([key, value]) => ["q", "tag", "category", "page"].includes(key) && value,
      ),
    ),
  ).toString();
  const { data, loading, error } = useApi(`/posts${qs ? `?${qs}` : ""}`);
  const setFilter = (patch) =>
    setSearchParams({ ...Object.fromEntries(searchParams), page: "1", ...patch });

  return (
    <section aria-labelledby="blog">
      <div className="page-intro">
        <p className="eyebrow">Field notes / 04</p>
        <h1 id="blog" className="mt-3 text-4xl sm:text-5xl">Security write-ups</h1>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Technical notes, investigations, and lessons from projects and practice.
        </p>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <form
          role="search"
          className="flex w-full max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter({ q: query.trim().length >= 2 ? query.trim() : "" });
          }}
        >
          <label htmlFor="q" className="sr-only">Search write-ups</label>
          <input
            id="q"
            className="input"
            value={query}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search posts…"
          />
          <button className="btn btn-solid shrink-0">Search</button>
        </form>
        {(searchParams.get("tag") || searchParams.get("q") || searchParams.get("category")) && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setQuery("");
              setSearchParams({});
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading && <LoadingSkeleton rows={3} />}
        {error && <p className="glass text-sm" role="alert">Could not load write-ups. Please try again shortly.</p>}
        {data && !data.items.length && (
          <div className="glass">
            <p className="font-medium">No posts found.</p>
            <p className="prose-copy mt-1 text-sm">Try another search term or clear the active filters.</p>
          </div>
        )}
        {data && data.items.length > 0 && (
          <motion.ul layout className="grid gap-4 lg:grid-cols-2">
            {data.items.map((post, index) => (
              <motion.li
                key={post._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.035 }}
                className="glass flex flex-col"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tag">{post.category}</span>
                  <time className="font-mono text-[10px] text-slate-500" dateTime={post.publishedAt}>
                    {fmt(post.publishedAt)}
                  </time>
                </div>
                <h2 className="mt-4 text-xl">
                  <Link className="hover:text-teal-700 dark:hover:text-teal-200" to={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                <p className="prose-copy mt-2 flex-1 text-sm">{post.excerpt}</p>
                {post.tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Post tags">
                    {post.tags.map((tag) => (
                      <li key={tag}>
                        <button className="tag transition hover:border-teal-600/50 hover:text-teal-700 dark:hover:text-teal-200" onClick={() => setFilter({ tag })}>
                          #{tag}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Link className="mt-5 inline-flex items-center gap-2 font-mono text-xs accent" to={`/blog/${post.slug}`}>
                  Read write-up <span aria-hidden="true">→</span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
      {data && data.pages > 1 && (
        <nav aria-label="Write-up pages" className="mt-7 flex items-center justify-center gap-4">
          <button
            className="btn btn-sm"
            disabled={data.page <= 1}
            onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(data.page - 1) })}
          >
            ← Previous
          </button>
          <span className="font-mono text-xs text-slate-500">Page {data.page} of {data.pages}</span>
          <button
            className="btn btn-sm"
            disabled={data.page >= data.pages}
            onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(data.page + 1) })}
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/posts/${encodeURIComponent(slug)}`);
  usePageTitle(
    data?.title || "Write-up",
    data?.excerpt || "A cybersecurity technical write-up by Sandip Kepchhaki.",
  );
  if (loading) return <LoadingSkeleton rows={4} className="mx-auto max-w-3xl" />;
  if (error)
    return (
      <div className="glass mx-auto max-w-2xl text-center" role="alert">
        <p className="eyebrow">404 / Not found</p>
        <h1 className="mt-2 text-2xl">This write-up isn’t available.</h1>
        <Link className="btn btn-solid mt-5" to="/blog">Back to write-ups</Link>
      </div>
    );
  return (
    <article className="mx-auto max-w-3xl">
      <Link className="inline-flex items-center gap-2 font-mono text-xs accent hover:underline" to="/blog">
        <span aria-hidden="true">←</span> All write-ups
      </Link>
      <header className="mb-8 mt-6 border-b border-slate-200 pb-7 dark:border-white/10">
        <p className="eyebrow">{data.category}</p>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{data.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <time className="font-mono text-xs text-slate-500" dateTime={data.publishedAt}>{fmt(data.publishedAt)}</time>
          {data.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}
        </div>
        {data.excerpt && <p className="prose-copy mt-5 text-base">{data.excerpt}</p>}
      </header>
      <div className="glass !p-5 sm:!p-8">
        <Markdown>{data.content}</Markdown>
      </div>
      <div className="mt-8 border-t border-slate-200 pt-5 dark:border-white/10">
        <Link className="btn" to="/blog">← Back to write-ups</Link>
      </div>
    </article>
  );
}
