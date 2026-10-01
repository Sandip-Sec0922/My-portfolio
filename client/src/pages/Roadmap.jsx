import { motion } from "framer-motion";
import StatusBadge from "../components/StatusBadge.jsx";
import { roadmap } from "../data/lab.js";
import { usePageTitle } from "../hooks.js";

export default function Roadmap() {
  usePageTitle("Roadmap");
  return (
    <section aria-labelledby="rm">
      <div className="page-intro">
        <p className="eyebrow">Progress log / 03</p>
        <h1 id="rm" className="mt-3 text-4xl sm:text-5xl">Learning roadmap</h1>
        <p className="mt-3 max-w-2xl leading-relaxed">
          A transparent view of completed learning, current builds, and the next goals.
        </p>
      </div>
      <ol className="relative ml-3 border-l border-slate-300 dark:border-white/15">
        {roadmap.map((item, index) => (
          <motion.li
            key={item.title}
            className="relative ml-7 pb-7 last:pb-0 sm:ml-10"
            initial={{ opacity: 0, x: 8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.2) }}
          >
            <span
              aria-hidden="true"
              className={`absolute -left-[35px] top-5 h-3 w-3 rounded-full border-2 sm:-left-[47px] ${item.status === "done" ? "border-teal-600 bg-teal-600 dark:border-teal-300 dark:bg-teal-300" : item.status === "in-progress" ? "border-teal-600 bg-white ring-4 ring-teal-500/15 dark:border-teal-300 dark:bg-slate-950" : "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-slate-950"}`}
            />
            <article className={`glass ${item.status === "in-progress" ? "!border-teal-600/40 dark:!border-teal-300/30" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                  <h2 className="text-base sm:text-lg">{item.title}</h2>
                </div>
                <StatusBadge status={item.status} />
              </div>
              {item.note && <p className="prose-copy mt-3 border-l-2 border-slate-200 pl-4 text-sm dark:border-white/10">{item.note}</p>}
            </article>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
