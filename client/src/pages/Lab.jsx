import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { detections, lab } from "../data/lab.js";
import { useApi, usePageTitle } from "../hooks.js";

const url = (id) =>
  `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;
const fmt = (date) => (date ? new Date(date).toISOString().slice(0, 10) : "");

function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const { data, loading, error } = useApi(
    `/posts?category=incident-report&page=${page}`,
  );
  if (loading) return <LoadingSkeleton rows={2} />;
  if (error) return <p role="alert">Could not load reports.</p>;
  if (!data.items.length) {
    return (
      <div className="glass">
        <p className="font-mono text-xs accent">NO REPORTS PUBLISHED</p>
        <p className="prose-copy mt-2 text-sm">
          Incident reports will be published here as lab investigations are completed.
        </p>
      </div>
    );
  }
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.items.map((post) => (
          <motion.li key={post._id} className="glass" whileHover={{ y: -3 }}>
            <Link
              className="text-lg font-medium accent hover:underline"
              to={`/blog/${post.slug}`}
            >
              {post.title}
            </Link>
            <p className="mt-2 font-mono text-[10px] text-slate-500">
              {fmt(post.publishedAt)}
            </p>
            <p className="prose-copy mt-2 text-sm">{post.excerpt}</p>
          </motion.li>
        ))}
      </ul>
      {data.pages > 1 && (
        <nav
          aria-label="Incident report pages"
          className="mt-6 flex items-center justify-center gap-4"
        >
          <button
            className="btn btn-sm"
            disabled={data.page <= 1}
            onClick={() =>
              setSearchParams({
                ...Object.fromEntries(searchParams),
                page: String(data.page - 1),
              })
            }
          >
            ← Previous
          </button>
          <span className="font-mono text-xs text-slate-500">
            Page {data.page} of {data.pages}
          </span>
          <button
            className="btn btn-sm"
            disabled={data.page >= data.pages}
            onClick={() =>
              setSearchParams({
                ...Object.fromEntries(searchParams),
                page: String(data.page + 1),
              })
            }
          >
            Next →
          </button>
        </nav>
      )}
    </>
  );
}

export default function Lab() {
  usePageTitle(
    "Home Lab",
    "SOC workflows, detection engineering plans, and incident-report write-ups from Sandip Kepchhaki's home lab.",
  );
  const built = detections.filter((detection) => detection.status === "built").length;
  const planned = detections.length - built;
  return (
    <div className="space-y-14">
      <section aria-labelledby="lab">
        <div className="page-intro">
          <p className="eyebrow">Practice environment / 02</p>
          <h1 id="lab" className="mt-3 text-4xl sm:text-5xl">Home lab & SOC workflow</h1>
          <p className="mt-3 max-w-3xl leading-relaxed">{lab.summary}</p>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Lab components", lab.components.length, "planned environment"],
            ["Detection ideas", detections.length, "mapped to ATT&CK"],
            ["Built detections", built, `${planned} planned`],
          ].map(([label, value, note]) => (
            <div className="glass !p-4" key={label}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold accent">{value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
            </div>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lab.components.map((component, index) => (
              <motion.li
                key={component.name}
                className="glass h-full"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.24, delay: index * 0.04 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-mono text-sm accent">{component.name}</h2>
                  <StatusBadge status={component.status} />
                </div>
                <p className="prose-copy mt-3 text-sm">{component.detail}</p>
              </motion.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="det">
        <div className="mb-5 max-w-3xl">
          <p className="eyebrow">Detection engineering</p>
          <h2 id="det" className="section-title mt-2">Detection backlog</h2>
          <p className="prose-copy mt-2 text-sm">
            {built} of {detections.length} built. Planned rows describe future work, not completed detections.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
          <table className="w-full min-w-[54rem] border-collapse bg-white/60 text-left text-sm dark:bg-white/[0.03]">
            <caption className="sr-only">Detections mapped to MITRE ATT&CK techniques</caption>
            <thead className="bg-slate-100/80 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:bg-white/5">
              <tr>
                {["Detection", "Tactic", "Technique", "Log source", "Logic", "Status"].map((heading) => (
                  <th key={heading} scope="col" className="border-b border-slate-200 px-4 py-3 dark:border-white/10">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detections.map((detection) => (
                <tr key={detection.technique} className="align-top transition hover:bg-teal-500/[0.04]">
                  <th scope="row" className="border-b border-slate-200 px-4 py-3 font-medium dark:border-white/10">{detection.name}</th>
                  <td className="border-b border-slate-200 px-4 py-3 text-slate-600 dark:border-white/10 dark:text-slate-300">{detection.tactic}</td>
                  <td className="border-b border-slate-200 px-4 py-3 font-mono dark:border-white/10">
                    <a className="accent underline" href={url(detection.technique)} target="_blank" rel="noopener noreferrer">{detection.technique}</a>
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 text-slate-600 dark:border-white/10 dark:text-slate-300">{detection.source}</td>
                  <td className="border-b border-slate-200 px-4 py-3 text-slate-600 dark:border-white/10 dark:text-slate-300">{detection.logic}</td>
                  <td className="border-b border-slate-200 px-4 py-3 dark:border-white/10"><StatusBadge status={detection.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ir">
        <div className="mb-5">
          <p className="eyebrow">Investigation notes</p>
          <h2 id="ir" className="section-title mt-2">Incident-report write-ups</h2>
          <Link
            className="mt-3 inline-flex font-mono text-xs accent hover:underline"
            to="/blog?category=incident-report"
          >
            View all incident reports →
          </Link>
        </div>
        <Reports />
      </section>
    </div>
  );
}
