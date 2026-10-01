import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApi, usePageTitle } from "../hooks.js";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="glass flex min-h-full flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg">{p.title}</h3>
        {p.featured && (
          <span className="tag !border-teal-700/20 !text-teal-800 dark:!text-teal-200">
            Featured
          </span>
        )}
      </div>
      <p className="prose-copy mt-2 text-sm">{p.summary}</p>
      <p className="prose-copy mt-4 whitespace-pre-line text-sm">{p.description}</p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Technologies">
        {p.tech.map((tech) => <li key={tech} className="tag">{tech}</li>)}
      </ul>
      {p.securityHighlights.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
          <h4 className="font-mono text-[11px] uppercase tracking-wider accent">Security highlights</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {p.securityHighlights.map((highlight) => (
              <li key={highlight} className="flex gap-2">
                <span className="accent" aria-hidden="true">↳</span>{highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {p.githubUrl && (
          <a className="btn btn-sm" href={p.githubUrl} rel="noopener noreferrer">
            Source code ↗
          </a>
        )}
        {p.liveUrl && (
          <a className="btn btn-sm" href={p.liveUrl} rel="noopener noreferrer">
            Live demo ↗
          </a>
        )}
      </div>
    </motion.li>
  );
}

function GithubPanel() {
  const { data, loading, error } = useApi("/github");
  if (loading) return <LoadingSkeleton rows={2} />;
  if (error) return <p role="alert">GitHub data is unavailable right now.</p>;
  return (
    <div className="space-y-5">
      <p className="font-mono text-sm text-slate-600 dark:text-slate-300">
        {data.repos.length} public repos · {data.totalStars} stars
        {data.stale && " · cached copy"}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Languages">
        {data.languages.slice(0, 8).map((language) => (
          <li key={language.name} className="tag">{language.name} {language.percent}%</li>
        ))}
      </ul>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.repos.slice(0, 8).map((repo) => (
          <motion.li key={repo.name} className="glass !p-4" whileHover={{ y: -2 }}>
            <a className="font-mono text-sm accent hover:underline" href={repo.url} rel="noopener noreferrer">
              {repo.name} ↗
            </a>
            <p className="prose-copy mt-2 text-sm">{repo.description || "No description"}</p>
            <p className="mt-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {repo.language || "—"} · ★ {repo.stars} · forks {repo.forks}
            </p>
          </motion.li>
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
    <div className="space-y-16">
      <section aria-labelledby="proj">
        <div className="page-intro">
          <p className="eyebrow">Selected work / 01</p>
          <h1 id="proj" className="mt-3 text-4xl sm:text-5xl">Projects & experiments</h1>
          <p className="mt-3 max-w-2xl leading-relaxed">
            Practical builds around threat intelligence, security automation,
            and secure-by-design web systems.
          </p>
        </div>
        <div role="group" aria-label="Filter by category" className="mb-6 flex flex-wrap gap-2">
          {CATS.map((category) => (
            <button
              key={category}
              aria-pressed={cat === category}
              onClick={() => setCat(category)}
              className={`btn !min-h-9 !rounded-full !px-3 !py-1.5 text-xs capitalize ${cat === category ? "btn-solid" : ""}`}
            >
              {category}
            </button>
          ))}
        </div>
        {loading && <LoadingSkeleton rows={3} />}
        {error && <p role="alert">Could not load projects.</p>}
        {data && (
          data.items.length === 0 ? (
            <p className="glass prose-copy">No projects in this category yet.</p>
          ) : (
            <motion.ul layout className="grid gap-4 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {data.items.map((project) => <ProjectCard key={project._id} p={project} />)}
              </AnimatePresence>
            </motion.ul>
          )
        )}
      </section>
      <section aria-labelledby="gh">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Open source activity</p>
            <h2 id="gh" className="section-title mt-2">From GitHub</h2>
          </div>
          <a className="btn btn-sm" href="https://github.com/Sandip-Sec0922" rel="noopener noreferrer">
            View profile ↗
          </a>
        </div>
        <div className="glass"><GithubPanel /></div>
      </section>
    </div>
  );
}
