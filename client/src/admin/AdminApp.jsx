import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { api } from "../api/client.js";
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
        <Link className="btn w-full" to="/admin/reset-password">
          Reset password
        </Link>
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

function ResetPassword() {
  usePageTitle("Reset admin password");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await api.post("/auth/password-reset/request", {
        email: email.trim(),
      });
      setRequested(true);
      setMessage(result.message);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function completeReset(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api.post("/auth/password-reset/complete", {
        email: email.trim(),
        otp,
        newPassword: password,
      });
      setComplete(true);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="reset-password" className="mx-auto max-w-sm">
      <h1 id="reset-password" className="mb-4 text-2xl">
        Reset admin password
      </h1>
      {complete ? (
        <div className="glass space-y-4" role="status">
          <p>Your password was reset. Sign in with your new password.</p>
          <Link className="btn btn-solid" to="/admin/login">
            Return to sign in
          </Link>
        </div>
      ) : (
        <div className="glass space-y-5">
          <form onSubmit={requestCode} className="space-y-4">
            <Field
              id="reset-email"
              label="Admin email"
              hint="If this address belongs to the admin account, a reset code will be emailed to it."
            >
              <input
                id="reset-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <button className="btn" disabled={busy}>
              {busy ? "Sending…" : "Email reset code"}
            </button>
          </form>
          {requested && (
            <form onSubmit={completeReset} className="space-y-4">
              <Field
                id="reset-otp"
                label="Six-digit code"
                hint="The code expires in 10 minutes."
              >
                <input
                  id="reset-otp"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  className="input"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </Field>
              <Field
                id="reset-new-password"
                label="New password"
                hint="Use 14–128 characters."
              >
                <input
                  id="reset-new-password"
                  type="password"
                  minLength={14}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <button className="btn btn-solid" disabled={busy}>
                {busy ? "Resetting…" : "Reset password"}
              </button>
            </form>
          )}
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <Link className="block text-sm accent hover:underline" to="/admin/login">
            Back to sign in
          </Link>
        </div>
      )}
    </section>
  );
}

const NAV_GROUPS = [
  {
    label: "Content",
    links: [["projects", "Projects"], ["posts", "Posts"]],
  },
  {
    label: "Communication",
    links: [["messages", "Messages"]],
  },
  {
    label: "Security",
    links: [["security", "Security log"]],
  },
  {
    label: "System",
    links: [["account", "Account"]],
  },
];

function Guard() {
  const { status, logout } = useAuth();
  const location = useLocation();
  const pageContentRef = useRef(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      pageContentRef.current?.focus({ preventScroll: true });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  if (status === "loading") return <p role="status">Checking session…</p>;
  if (status === "out") return <Navigate to="/admin/login" replace />;
  const current = NAV_GROUPS.flatMap(({ label, links }) =>
    links.map(([to, name]) => ({ section: label, name, path: `/admin/${to}` })),
  ).find(({ path }) => path === location.pathname);
  return (
    <div className="admin-console">
      <aside className="admin-sidebar">
        <Link to="/admin/projects" className="admin-wordmark">
          <span className="admin-mark" aria-hidden="true">SK</span>
          <span><strong>Sandip</strong><small>SECURITY CONSOLE</small></span>
        </Link>
        <nav aria-label="Admin" className="admin-navigation">
          {NAV_GROUPS.map(({ label, links }) => (
            <div className="admin-nav-group" key={label}>
              <p>{label}</p>
              {links.map(([to, name]) => (
                <NavLink
                  key={to}
                  to={`/admin/${to}`}
                  className={({ isActive }) => `admin-nav-link${isActive ? " is-active" : ""}`}
                >
                  <span className="admin-nav-indicator" aria-hidden="true" />
                  {name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span><i aria-hidden="true" />Authenticated session</span>
          <button className="admin-signout" onClick={logout}>
            Sign out <span aria-hidden="true">↗</span>
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p>{current?.section || "Workspace"} <span aria-hidden="true">/</span> {current?.name || "Admin"}</p>
            <span>Private administration area</span>
          </div>
          <span className="admin-topbar-state"><i aria-hidden="true" />Signed in</span>
        </header>
        <div
          ref={pageContentRef}
          id="admin-page-content"
          tabIndex={-1}
          className="admin-page-content"
        >
          <Outlet />
        </div>
      </div>
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
      <div className="admin-root min-h-screen">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-slate-950"
        >
          Skip to admin content
        </a>
        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
        >
          <Routes>
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin/reset-password"
              element={<ResetPassword />}
            />
            <Route element={<Guard />}>
              <Route
                path="/admin"
                element={<Navigate to="/admin/projects" replace />}
              />
              <Route path="/admin/projects" element={<ProjectsAdmin />} />
              <Route path="/admin/posts" element={<PostsAdmin />} />
              <Route path="/admin/messages" element={<MessagesAdmin />} />
              <Route path="/admin/security" element={<SecurityLog />} />
              <Route path="/admin/account" element={<AccountAdmin />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
