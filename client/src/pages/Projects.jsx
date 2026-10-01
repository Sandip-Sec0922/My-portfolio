import { useState } from "react";
import { motion } from "framer-motion";
import { useApi, usePageTitle } from "../hooks.js";

const CATS = [
  "all",
  "detection",
  "automation",
  "web-security",
  "networking",
  "forensics",
  "other",
];

function ProjectCard({ p }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass flex flex-col"
    >
      <h3 className="text-lg">{p.title}</h3>
      <p className="mt-1 text-sm">{p.summary}</p>
      <p className="mt-3 whitespace-pre-line text-sm">{p.description}</p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Technologies">
        {p.tech.map((t) => (
          <li key={t} className="tag">
            {t}
          </li>
        ))}
      </ul>
      {p.securityHighlights.length > 0 && (
        <div className="mt-3">
          <h4 className="font-mono text-xs accent">Security highlights</h4>
          <ul className="mt-1 list-inside list-disc text-sm">
            {p.securityHighlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex gap-3 pt-4">
        {p.githubUrl && (
          <a className="btn" href={p.githubUrl} rel="noopener noreferrer">
            Code
          </a>
        )}
        {p.liveUrl && (
          <a className="btn" href={p.liveUrl} rel="noopener noreferrer">
            Live demo
          </a>
        )}
      </div>
    </motion.li>
  );
}

function GithubPanel() {
  const { data, loading, error } = useApi("/github");
  if (loading) return <p>Loading GitHub data…</p>;
  if (error) return <p role="alert">GitHub data is unavailable right now.</p>;
  return (
    <div className="space-y-4">
      <p className="font-mono text-sm">
        {data.repos.length} public repos · {data.totalStars} stars
        {data.stale && " · cached copy"}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Languages">
        {data.languages.slice(0, 8).map((l) => (
          <li key={l.name} className="tag">
            {l.name} {l.percent}%
          </li>
        ))}
      </ul>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.repos.slice(0, 8).map((r) => (
          <li key={r.name} className="glass">
            <a
              className="font-mono accent underline"
              href={r.url}
              rel="noopener noreferrer"
            >
              {r.name}
            </a>
            <p className="mt-1 text-sm">{r.description || "No description"}</p>
            <p className="mt-2 font-mono text-xs">
              {r.language || "—"} · ★ {r.stars} · forks {r.forks}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Projects() {
  usePageTitle("Projects");
  const [cat, setCat] = useState("all");
  const { data, loading, error } = useApi(
    cat === "all" ? "/projects" : `/projects?category=${cat}`,
  );
  return (
    <div className="space-y-12">
      <section aria-labelledby="proj">
        <h1 id="proj" className="mb-4 text-3xl">
          Projects
        </h1>
        <div
          role="group"
          aria-label="Filter by category"
          className="mb-6 flex flex-wrap gap-2"
        >
          {CATS.map((c) => (
            <button
              key={c}
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`btn ${cat === c ? "btn-solid" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
        {loading && <p>Loading…</p>}
        {error && <p role="alert">Could not load projects.</p>}
        {data &&
          (data.items.length === 0 ? (
            <p>No projects in this category yet.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {data.items.map((p) => (
                <ProjectCard key={p._id} p={p} />
              ))}
            </ul>
          ))}
      </section>
      <section aria-labelledby="gh">
        <h2 id="gh" className="mb-4 text-2xl">
          Live from GitHub
        </h2>
        <GithubPanel />
      </section>
    </div>
  );
}
