import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge.jsx";
import { detections, lab } from "../data/lab.js";
import { useApi, usePageTitle } from "../hooks.js";

const url = (id) =>
  `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function Reports() {
  const { data, loading, error } = useApi("/posts?category=incident-report");
  if (loading) return <p>Loading…</p>;
  if (error) return <p role="alert">Could not load reports.</p>;
  if (!data.items.length)
    return (
      <p>
        No incident reports published yet. The first one will come from a lab
        attack.
      </p>
    );
  return (
    <ul className="space-y-3">
      {data.items.map((p) => (
        <li key={p._id} className="glass">
          <Link
            className="accent text-lg hover:underline"
            to={`/blog/${p.slug}`}
          >
            {p.title}
          </Link>
          <p className="font-mono text-xs">{fmt(p.publishedAt)}</p>
          <p className="mt-1 text-sm">{p.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

export default function Lab() {
  usePageTitle("Home Lab");
  const built = detections.filter((d) => d.status === "built").length;
  return (
    <div className="space-y-12">
      <section aria-labelledby="lab">
        <h1 id="lab" className="mb-2 text-3xl">
          Home Lab / SOC
        </h1>
        <p className="mb-4">{lab.summary}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {lab.components.map((c) => (
            <li key={c.name} className="glass">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-mono text-sm accent">{c.name}</h2>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-2 text-sm">{c.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="det">
        <h2 id="det" className="mb-1 text-2xl">
          Detections and MITRE ATT&amp;CK mapping
        </h2>
        <p className="mb-4 text-sm">
          {built} of {detections.length} built. Planned rows are the target set,
          not finished work.
        </p>
        <div className="overflow-x-auto">
          <table className="glass w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">
              Detections mapped to MITRE ATT&amp;CK techniques
            </caption>
            <thead>
              <tr className="font-mono">
                {[
                  "Detection",
                  "Tactic",
                  "Technique",
                  "Log source",
                  "Logic",
                  "Status",
                ].map((h) => (
                  <th key={h} scope="col" className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detections.map((d) => (
                <tr key={d.technique} className="align-top">
                  <th scope="row" className="p-2 font-medium">
                    {d.name}
                  </th>
                  <td className="p-2">{d.tactic}</td>
                  <td className="p-2 font-mono">
                    <a
                      className="accent underline"
                      href={url(d.technique)}
                      rel="noopener noreferrer"
                    >
                      {d.technique}
                    </a>
                  </td>
                  <td className="p-2">{d.source}</td>
                  <td className="p-2">{d.logic}</td>
                  <td className="p-2">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ir">
        <h2 id="ir" className="mb-4 text-2xl">
          Incident-report write-ups
        </h2>
        <Reports />
      </section>
    </div>
  );
}
