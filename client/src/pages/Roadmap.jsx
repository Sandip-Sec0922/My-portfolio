import StatusBadge from "../components/StatusBadge.jsx";
import { roadmap } from "../data/lab.js";
import { usePageTitle } from "../hooks.js";

export default function Roadmap() {
  usePageTitle("Roadmap");
  return (
    <section aria-labelledby="rm">
      <h1 id="rm" className="mb-2 text-3xl">
        Certifications and learning roadmap
      </h1>
      <p className="mb-8 text-sm">Where I am, and what comes next.</p>
      <ol className="ml-3 border-l border-slate-400 dark:border-white/20">
        {roadmap.map((r) => (
          <li key={r.title} className="relative ml-6 pb-8 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-cyan-700 dark:border-cyan-300 ${r.status === "done" ? "bg-cyan-700 dark:bg-cyan-300" : "bg-slate-50 dark:bg-slate-950"}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg">{r.title}</h2>
              <StatusBadge status={r.status} />
            </div>
            {r.note && <p className="mt-1 text-sm">{r.note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
