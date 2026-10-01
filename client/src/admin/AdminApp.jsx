import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { errText, Field } from "./ui.jsx";
import { usePageTitle } from "../hooks.js";
import ProjectsAdmin from "./ProjectsAdmin.jsx";
import PostsAdmin from "./PostsAdmin.jsx";
import MessagesAdmin from "./MessagesAdmin.jsx";
import SecurityLog from "./SecurityLog.jsx";
import AccountAdmin from "./AccountAdmin.jsx";

function Login() {
  usePageTitle("Admin sign in");
  const { status, notice, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "in") return <Navigate to="/admin/projects" replace />;

  async function submit(ev) {
    ev.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setErr(errText(e)); // generic by design: the API never says whether the email exists
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="login" className="mx-auto max-w-sm">
      <h1 id="login" className="mb-4 text-2xl">
        Admin sign in
      </h1>
      <form onSubmit={submit} className="glass space-y-4">
        <Field id="email" label="Email">
          <input
            id="email"
            type="email"
            required
            maxLength={254}
            autoComplete="username"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="password" label="Password">
          <input
            id="password"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button className="btn btn-solid" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {err}
        </p>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}

const NAV = [
  ["projects", "Projects"],
  ["posts", "Posts"],
  ["messages", "Messages"],
  ["security", "Security log"],
  ["account", "Account"],
];

function Guard() {
  const { status, logout } = useAuth();
  if (status === "loading") return <p>Checking session…</p>;
  if (status === "out") return <Navigate to="/admin/login" replace />;
  return (
    <div className="space-y-6">
      <nav
        aria-label="Admin"
        className="glass flex flex-wrap items-center gap-x-4 gap-y-2 !p-3 text-sm"
      >
        <span className="font-mono accent">admin</span>
        {NAV.map(([to, label]) => (
          <NavLink
            key={to}
            to={`/admin/${to}`}
            className={({ isActive }) =>
              `hover:underline ${isActive ? "font-semibold accent" : ""}`
            }
          >
            {label}
          </NavLink>
        ))}
        <button className="btn btn-sm ml-auto" onClick={logout}>
          Sign out
        </button>
      </nav>
      <Outlet />
    </div>
  );
}

export default function AdminApp() {
  // The admin screens should never show up in search results.
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<Guard />}>
          <Route index element={<Navigate to="/admin/projects" replace />} />
          <Route path="projects" element={<ProjectsAdmin />} />
          <Route path="posts" element={<PostsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
          <Route path="security" element={<SecurityLog />} />
          <Route path="account" element={<AccountAdmin />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  );
}
