import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import Markdown from "../components/Markdown.jsx";
import { usePageTitle } from "../hooks.js";
import { useAuth } from "./auth.jsx";
import { Field } from "./ui.jsx";

const CATS = ["ctf", "log-analysis", "tool-guide", "incident-report", "other"];
const blank = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "ctf",
  tags: "",
  published: false,
};
const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const toPayload = (v) => ({
  title: v.title.trim(),
  slug: v.slug.trim(),
  excerpt: v.excerpt.trim(),
  content: v.content,
  category: v.category,
  tags: [
    ...new Set(
      v.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ],
  published: v.published,
});

export default function PostsAdmin() {
  usePageTitle("Admin: posts");
  const { fail } = useAuth();
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null); // { id?, slugTouched, preview, values }
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api.get("/admin/posts")).items);
    } catch (e) {
      setErr(fail(e));
    }
  }, [fail]);
  useEffect(() => {
    load();
  }, [load]);

  const setVal = (k, v) =>
    setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }));
  const bind = (k) => ({
    id: k,
    value: form.values[k],
    onChange: (e) => setVal(k, e.target.value),
  });

  async function edit(id) {
    setErr("");
    try {
      const p = await api.get(`/admin/posts/${id}`);
      setForm({
        id,
        slugTouched: true,
        preview: false,
        values: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          content: p.content,
          category: p.category,
          tags: (p.tags || []).join(", "),
          published: !!p.published,
        },
      });
    } catch (e) {
      setErr(fail(e));
    }
  }

  async function save(ev) {
    ev.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body = toPayload(form.values);
      if (form.id) await api.put(`/admin/posts/${form.id}`, body);
      else await api.post("/admin/posts", body);
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
    try {
      await api.del(`/admin/posts/${p._id}`);
      await load();
    } catch (e) {
      setErr(fail(e));
    }
  }

  if (form) {
    const v = form.values;
    return (
      <section aria-labelledby="pf">
        <h1 id="pf" className="mb-4 text-2xl">
          {form.id ? "Edit post" : "New post"}
        </h1>
        <form onSubmit={save} className="glass max-w-3xl space-y-4">
          <Field id="title" label="Title">
            <input
              id="title"
              required
              maxLength={150}
              className="input"
              value={v.title}
              onChange={(e) => {
                setVal("title", e.target.value);
                if (!form.slugTouched) setVal("slug", slugify(e.target.value)); // suggest a slug until the admin edits it
              }}
            />
          </Field>
          <Field id="slug" label="Slug">
            <input
              id="slug"
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className="input"
              value={v.slug}
              onChange={(e) => {
                setForm((f) => ({ ...f, slugTouched: true }));
                setVal("slug", e.target.value);
              }}
            />
          </Field>
          <Field id="excerpt" label="Excerpt (max 300)">
            <textarea
              required
              rows={2}
              maxLength={300}
              className="input"
              {...bind("excerpt")}
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
            id="tags"
            label="Tags"
            hint="Comma separated, lowercase letters, numbers and hyphens, max 10."
          >
            <input className="input" {...bind("tags")} />
          </Field>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="content" className="text-sm">
                Content (Markdown, max about 200 KB)
              </label>
              <button
                type="button"
                className="btn btn-sm"
                aria-pressed={form.preview}
                onClick={() => setForm((f) => ({ ...f, preview: !f.preview }))}
              >
                {form.preview ? "Edit" : "Preview"}
              </button>
            </div>
            {form.preview ? (
              <div className="glass min-h-[12rem]">
                <Markdown>{v.content || "*Nothing to preview*"}</Markdown>
              </div>
            ) : (
              <textarea
                id="content"
                required
                rows={18}
                className="input font-mono text-sm"
                {...bind("content")}
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.published}
              onChange={(e) => setVal("published", e.target.checked)}
            />{" "}
            Published (visible on the public blog)
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
          Posts
        </h1>
        <button
          className="btn btn-solid"
          onClick={() => {
            setErr("");
            setForm({ slugTouched: false, preview: false, values: blank });
          }}
        >
          New post
        </button>
      </div>
      <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">
        {err}
      </p>
      {!items ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li
              key={p._id}
              className="glass flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="font-mono text-xs">
                  {p.published ? "published" : "draft"} · {p.category} · /
                  {p.slug}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => edit(p._id)}>
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
