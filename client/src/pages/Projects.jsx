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

function ProjectCard({ p, index }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="project-story"
    >
      <div className="project-index" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className="project-index-line" />
        <span className="font-mono text-[10px] uppercase tracking-widest">{p.category}</span>
      </div>
      <div className="project-story-body">
        <div className="flex items-start justify-between gap-3">
          <h2 className="project-title">{p.title}</h2>
          {p.featured && <span className="tag shrink-0">Featured</span>}
        </div>
        <p className="project-summary">{p.summary}</p>
        <p className="prose-copy mt-4 whitespace-pre-line text-sm">{p.description}</p>
        {p.securityHighlights?.length > 0 && (
          <div className="project-highlights">
            <h3 className="font-mono text-[11px] uppercase tracking-wider accent">Security notes</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {p.securityHighlights.map((highlight) => (
                <li key={highlight}><span aria-hidden="true">↳ </span>{highlight}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <ul className="flex flex-wrap gap-2" aria-label="Technologies">
            {(p.tech || []).map((tech) => <li key={tech} className="tag">{tech}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            {p.githubUrl && <a className="project-link" href={p.githubUrl} rel="noopener noreferrer">Source code <span aria-hidden="true">↗</span></a>}
            {p.liveUrl && <a className="project-link" href={p.liveUrl} rel="noopener noreferrer">Live demo <span aria-hidden="true">↗</span></a>}
          </div>
        </div>
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
      <ul className="repository-list">
        {data.repos.slice(0, 8).map((repo, index) => (
          <motion.li key={repo.name} className="repository-row" whileHover={{ x: 3 }}>
            <span className="repository-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <a className="font-medium accent hover:underline" href={repo.url} rel="noopener noreferrer">
                {repo.name} <span aria-hidden="true">↗</span>
              </a>
              <p className="prose-copy mt-1 text-sm">{repo.description || "Repository description not provided."}</p>
            </div>
            <p className="repository-meta">{repo.language || "Language not specified"}<span>★ {repo.stars}</span></p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export default function Projects() {
  usePageTitle(
    "Projects",
    "Security automation, threat-intelligence, and secure-by-design projects by Sandip Kepchhaki.",
  );
  const [cat, setCat] = useState("all");
  const { data, loading, error } = useApi(
    cat === "all" ? "/projects" : `/projects?category=${cat}`,
  );
  return (
    <div className="projects-page space-y-20">
      <section aria-labelledby="proj">
        <div className="page-intro">
          <p className="eyebrow">Selected work / 01</p>
          <h1 id="proj" className="projects-title">Projects &amp; experiments</h1>
          <p className="projects-lede">
            Builds at the intersection of security operations, threat intelligence,
            and software engineering. Each entry is drawn from project data — no
            invented results or screenshots.
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
            <motion.ul layout className="project-list">
              <AnimatePresence mode="popLayout">
                {data.items.map((project, index) => <ProjectCard key={project._id} p={project} index={index} />)}
              </AnimatePresence>
            </motion.ul>
          )
        )}
      </section>
      <section aria-labelledby="gh" className="github-section">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Repository index / 02</p>
            <h2 id="gh" className="section-title mt-2">Open source, live from GitHub</h2>
          </div>
          <a className="btn btn-sm" href="https://github.com/Sandip-Sec0922" rel="noopener noreferrer">
            View profile ↗
          </a>
        </div>
        <GithubPanel />
      </section>
    </div>
  );
}
