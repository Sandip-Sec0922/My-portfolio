import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import { usePageTitle } from "../hooks.js";
import { useAuth } from "./auth.jsx";
import { Field } from "./ui.jsx";

const CATS = [
  "detection",
  "automation",
  "web-security",
  "networking",
  "forensics",
  "other",
];
const split = (s, sep) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

const blank = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  category: "automation",
  tech: "",
  securityHighlights: "",
  githubUrl: "",
  liveUrl: "",
  featured: false,
  order: 0,
};

const toForm = (p) => ({
  ...blank,
  title: p.title,
  slug: p.slug,
  summary: p.summary,
  description: p.description,
  category: p.category,
  tech: (p.tech || []).join(", "),
  securityHighlights: (p.securityHighlights || []).join("\n"),
  githubUrl: p.githubUrl || "",
  liveUrl: p.liveUrl || "",
  featured: !!p.featured,
  order: p.order || 0,
});

// Empty URL -> null so an edit can actually clear a previously saved link (the schema accepts null).
const toPayload = (v) => ({
  title: v.title.trim(),
  slug: v.slug.trim(),
  summary: v.summary.trim(),
  description: v.description.trim(),
  category: v.category,
  tech: split(v.tech, ","),
  securityHighlights: split(v.securityHighlights, "\n"),
  githubUrl: v.githubUrl.trim() || null,
  liveUrl: v.liveUrl.trim() || null,
  featured: v.featured,
  order: Number(v.order) || 0,
});

export default function ProjectsAdmin() {
  usePageTitle("Admin: projects");
  const { fail } = useAuth();
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null); // null = list view, else { id?, values }
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api.get("/admin/projects")).items);
    } catch (e) {
      setErr(fail(e));
    }
  }, [fail]);
  useEffect(() => {
    load();
  }, [load]);

  const bind = (k) => ({
    id: k,
    value: form.values[k],
    onChange: (e) =>
      setForm((f) => ({
        ...f,
        values: {
          ...f.values,
          [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
        },
      })),
  });

  async function save(ev) {
    ev.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body = toPayload(form.values);
      if (form.id) await api.put(`/admin/projects/${form.id}`, body);
      else await api.post("/admin/projects", body);
      setForm(null);
      await load();
    } catch (e) {
      setErr(fail(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setErr("");
    try {
      await api.del(`/admin/projects/${p._id}`);
      await load();
    } catch (e) {
      setErr(fail(e));
    }
  }

  if (form) {
    return (
      <section aria-labelledby="pf">
        <h1 id="pf" className="mb-4 text-2xl">
          {form.id ? "Edit project" : "New project"}
        </h1>
        <form onSubmit={save} className="glass max-w-2xl space-y-4">
          <Field id="title" label="Title">
            <input
              required
              maxLength={100}
              className="input"
              {...bind("title")}
            />
          </Field>
          <Field
            id="slug"
            label="Slug"
            hint="Lowercase letters, numbers and hyphens."
          >
            <input
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className="input"
              {...bind("slug")}
            />
          </Field>
          <Field id="summary" label="Summary (max 200)">
            <input
              required
              maxLength={200}
              className="input"
              {...bind("summary")}
            />
          </Field>
          <Field id="description" label="Description (max 3000)">
            <textarea
              required
              rows={6}
              maxLength={3000}
              className="input"
              {...bind("description")}
            />
          </Field>
          <Field id="category" label="Category">
            <select className="input" {...bind("category")}>
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field
            id="tech"
            label="Tech"
            hint="Comma separated, max 20 items, 30 characters each."
          >
            <input className="input" {...bind("tech")} />
          </Field>
          <Field
            id="securityHighlights"
            label="Security highlights"
            hint="One per line, max 10."
          >
            <textarea
              rows={4}
              className="input"
              {...bind("securityHighlights")}
            />
          </Field>
          <Field
            id="githubUrl"
            label="GitHub URL"
            hint="Must be https://github.com/…"
          >
            <input type="url" className="input" {...bind("githubUrl")} />
          </Field>
          <Field id="liveUrl" label="Live demo URL" hint="Must be https.">
            <input type="url" className="input" {...bind("liveUrl")} />
          </Field>
          <Field id="order" label="Order (lower shows first)">
            <input
              type="number"
              min={0}
              max={1000}
              className="input"
              {...bind("order")}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.values.featured}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  values: { ...f.values, featured: e.target.checked },
                }))
              }
            />{" "}
            Featured
          </label>
          <div className="flex gap-3">
            <button className="btn btn-solid" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setForm(null);
                setErr("");
              }}
            >
              Cancel
            </button>
          </div>
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {err}
          </p>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="pl">
      <div className="mb-4 flex items-center justify-between">
        <h1 id="pl" className="text-2xl">
          Projects
        </h1>
        <button
          className="btn btn-solid"
          onClick={() => {
            setErr("");
            setForm({ values: blank });
          }}
        >
          New project
        </button>
      </div>
      <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">
        {err}
      </p>
      {!items ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No projects yet. Add Cyber Intel Board first.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li
              key={p._id}
              className="glass flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">
                  {p.title}
                  {p.featured && <span className="tag ml-2">featured</span>}
                </p>
                <p className="font-mono text-xs">
                  {p.category} · order {p.order} · /{p.slug}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setErr("");
                    setForm({ id: p._id, values: toForm(p) });
                  }}
                >
                  Edit
                </button>
                <button className="btn-danger" onClick={() => remove(p)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
