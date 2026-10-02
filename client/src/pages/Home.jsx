import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal.jsx";
import { profile, skills } from "../data/profile.js";
import { usePageTitle, useTyping } from "../hooks.js";

export default function Home() {
  usePageTitle("Aspiring SOC Analyst");
  const typed = useTyping(profile.terminal);
  return (
    <div className="space-y-20 sm:space-y-24">
      <section
        aria-labelledby="hero"
        className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14"
      >
        <div>
          <p className="eyebrow">
            <span className="status-dot" />
            Cybersecurity · SOC learning path
          </p>
          <h1 id="hero" className="mt-5 max-w-3xl text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            Hello, I’m{" "}
            <span className="bg-gradient-to-r from-teal-700 to-cyan-600 bg-clip-text text-transparent dark:from-teal-200 dark:to-cyan-300">
              {profile.name}
            </span>
            .
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl">
            {profile.title}
          </p>
          <p className="prose-copy mt-4 max-w-xl">
            Building hands-on security projects, exploring detection workflows,
            and documenting the learning process along the way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn btn-solid" to="/projects">
              Explore projects <span aria-hidden="true">↗</span>
            </Link>
            <Link className="btn" to="/contact">
              Get in touch
            </Link>
            <a className="btn" href="/resume.pdf">
              Resume <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-slate-500 dark:text-slate-400">
            <a className="hover:text-teal-700 dark:hover:text-teal-200" href={profile.github} rel="noopener noreferrer">
              GitHub ↗
            </a>
            <a className="hover:text-teal-700 dark:hover:text-teal-200" href={profile.linkedin} rel="noopener noreferrer">
              LinkedIn ↗
            </a>
            <Link className="hover:text-teal-700 dark:hover:text-teal-200" to="/security">
              Security posture →
            </Link>
          </div>
        </div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-teal-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-slate-950 text-slate-100 shadow-2xl shadow-teal-950/20 dark:border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <span className="font-mono text-[10px] tracking-wide text-slate-400">
                sandip@security-lab ~
              </span>
              <span className="w-8" />
            </div>
            <div className="min-h-64 px-5 py-6 sm:px-7 sm:py-8">
              <p className="font-mono text-xs text-teal-300">WORKING NOTES / 01</p>
              <pre
                className="mt-5 whitespace-pre-wrap font-mono text-xs leading-7 text-slate-200 sm:text-sm"
                aria-hidden="true"
              >
                  <span className="text-teal-300">{typed}</span>
                  <span className="ml-0.5 animate-pulse text-teal-200">▌</span>
              </pre>
              <p className="sr-only">{profile.terminal.join("\n")}</p>
              <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[10px] text-slate-500">
                <span>LEARN · DETECT · DOCUMENT</span>
                <span className="text-teal-300">SESSION ACTIVE</span>
              </div>
            </div>
          </div>
          <div className="glass absolute -bottom-5 -left-3 hidden !px-4 !py-3 sm:block">
            <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">CURRENT FOCUS</p>
            <p className="mt-1 text-sm font-medium">SOC fundamentals & detection</p>
          </div>
        </motion.div>
      </section>

      <Reveal>
        <section aria-labelledby="about">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Background</p>
              <h2 id="about" className="section-title mt-2">Learning by building</h2>
            </div>
            <span className="tag">ABOUT / 01</span>
          </div>
          <div className="glass grid gap-5 md:grid-cols-2">
            {profile.about.map((paragraph) => (
              <p key={paragraph} className="prose-copy">{paragraph}</p>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="skills">
          <div className="mb-5 max-w-2xl">
            <p className="eyebrow">Current toolkit</p>
            <h2 id="skills" className="section-title mt-2">Skills & areas of study</h2>
            <p className="prose-copy mt-2 text-sm">
              Solid labels indicate hands-on project use; outlined labels are
              currently being studied or practised.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(skills).map(([group, items], index) => (
              <motion.div
                key={group}
                className="glass"
                whileHover={{ y: -3 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-sm accent">{group}</h3>
                  <span className="font-mono text-[10px] text-slate-400">0{index + 1}</span>
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {items.map((skill) => (
                    <li
                      key={skill.n}
                      className={`tag ${skill.l === "learning" ? "!border-dashed !bg-transparent" : "!border-teal-700/20 !bg-teal-500/10 !text-teal-800 dark:!border-teal-300/20 dark:!text-teal-200"}`}
                    >
                      {skill.n}
                      <span className="sr-only"> ({skill.l})</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="glass flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Next steps</p>
            <h2 className="mt-2 text-xl">Explore the work behind the learning.</h2>
            <p className="prose-copy mt-1 text-sm">Projects, lab plans, and technical write-ups.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-solid" to="/lab">View lab</Link>
            <Link className="btn" to="/blog">Read write-ups</Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
