import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal.jsx";
import { profile, skills } from "../data/profile.js";
import { usePageTitle } from "../hooks.js";

const pipeline = ["Collect", "Enrich", "Triage", "Alert"];

export default function Home() {
  usePageTitle(
    "Cybersecurity & Security Automation",
    "Sandip Kepchhaki's cybersecurity portfolio: SOC learning, security projects, threat-intelligence automation, and technical write-ups.",
  );
  return (
    <div className="home-page space-y-24 sm:space-y-32">
      <section
        aria-labelledby="hero"
        className="hero-layout"
      >
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" />Cybersecurity · SOC · Automation</p>
          <h1 id="hero" className="hero-title">
            Building toward systems that <span>detect, defend &amp; automate.</span>
          </h1>
          <p className="hero-lede">
            I’m {profile.name}, a cybersecurity learner and software builder focused
            on threat intelligence, security operations, and practical automation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn btn-solid" to="/projects">
              Explore work <span aria-hidden="true">↗</span>
            </Link>
            <a className="btn" href="/resume.pdf" download>
              View resume <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-links mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs">
            <a href={profile.github} rel="noopener noreferrer">
              GitHub profile ↗
            </a>
            <a href={profile.linkedin} rel="noopener noreferrer">
              LinkedIn ↗
            </a>
            <Link to="/contact">Contact →</Link>
          </div>
        </div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          <div className="workflow-board">
            <div className="workflow-head">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-cyan-300">PROJECT WORKFLOW / 01</p>
                <h2 className="mt-2 text-xl text-white sm:text-2xl">Cyber Intel Board</h2>
              </div>
              <span className="workflow-state"><span aria-hidden="true" />Built project</span>
            </div>
            <p className="workflow-description">
              A threat-intelligence project practising a focused operational loop.
            </p>
            <ol className="workflow-steps" aria-label="Cyber Intel Board workflow">
              {pipeline.map((step, index) => (
                <li key={step}>
                  <span className="workflow-number">0{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="workflow-foot">
              <span>THREAT INTELLIGENCE</span>
              <span>COLLECT · TRIAGE · ALERT</span>
            </div>
          </div>
        </motion.div>
      </section>

      <Reveal>
        <section id="about" aria-labelledby="about-title" className="about-section">
          <div className="about-heading">
            <p className="eyebrow">About / 01</p>
            <h2 id="about-title" className="section-title mt-3">Learning by building.<br />Building to understand.</h2>
          </div>
          <div className="about-copy">
            {profile.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="skills">
          <div className="mb-7 max-w-2xl">
            <p className="eyebrow">Toolkit / 02</p>
            <h2 id="skills" className="section-title mt-3">Areas of practice</h2>
            <p className="prose-copy mt-3 text-sm">Hands-on labels reflect tools used in projects; learning labels are active study areas.</p>
          </div>
          <dl className="skill-list">
            {Object.entries(skills).map(([group, items], index) => (
              <div className="skill-row" key={group}>
                <dt><span className="skill-index">0{index + 1}</span>{group}</dt>
                <dd className="flex flex-wrap gap-2">
                  {items.map((skill) => (
                    <span key={skill.n} className={`skill-chip ${skill.l === "learning" ? "is-learning" : ""}`}>
                      {skill.n}<span className="sr-only"> ({skill.l})</span>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal>
        <section className="next-step">
          <div>
            <p className="eyebrow">Continue exploring / 03</p>
            <h2 className="mt-3 text-2xl sm:text-3xl">The work is the story.</h2>
            <p className="prose-copy mt-2 text-sm">Projects, lab plans, and technical write-ups — with progress clearly labelled.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-solid" to="/lab">Explore the lab</Link>
            <Link className="btn" to="/blog">Read field notes</Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
