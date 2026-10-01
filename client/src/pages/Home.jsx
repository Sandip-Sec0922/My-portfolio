import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { profile, skills } from "../data/profile.js";
import { usePageTitle, useTyping } from "../hooks.js";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function Home() {
  usePageTitle("Aspiring SOC Analyst");
  const typed = useTyping(profile.terminal);
  return (
    <div className="space-y-20">
      <section aria-labelledby="hero">
        <p className="font-mono text-sm accent">Hello, I am</p>
        <h1 id="hero" className="mt-1 text-4xl sm:text-5xl">
          {profile.name}
        </h1>
        <p className="mt-2 text-lg">{profile.title}</p>
        {/* aria-label gives screen readers the final text instead of a letter-by-letter stream */}
        <pre
          className="glass mt-6 min-h-[8rem] overflow-x-auto font-mono text-sm"
          aria-label={profile.terminal.join(" ")}
        >
          <span aria-hidden="true">
            {typed}
            <span className="animate-pulse">▌</span>
          </span>
        </pre>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-solid" to="/projects">
            View projects
          </Link>
          <Link className="btn" to="/contact">
            Contact me
          </Link>
          <a className="btn" href="/resume.pdf">
            Resume (PDF)
          </a>
          <a className="btn" href={profile.github} rel="noopener noreferrer">
            GitHub
          </a>
          <a className="btn" href={profile.linkedin} rel="noopener noreferrer">
            LinkedIn
          </a>
        </div>
      </section>

      <motion.section {...fade} aria-labelledby="about">
        <h2 id="about" className="mb-4 text-2xl">
          About
        </h2>
        <div className="glass space-y-3">
          {profile.about.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </motion.section>

      <motion.section {...fade} aria-labelledby="skills">
        <h2 id="skills" className="mb-1 text-2xl">
          Skills
        </h2>
        <p className="mb-4 text-sm">
          Solid tag = used in a project. Dashed tag = actively learning.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(skills).map(([group, items]) => (
            <div key={group} className="glass">
              <h3 className="mb-3 font-mono text-sm accent">{group}</h3>
              <ul className="flex flex-wrap gap-2">
                {items.map((s) => (
                  <li
                    key={s.n}
                    className={`tag ${s.l === "learning" ? "border border-dashed border-slate-500 bg-transparent" : ""}`}
                  >
                    {s.n}
                    <span className="sr-only"> ({s.l})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
