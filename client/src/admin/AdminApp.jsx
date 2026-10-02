import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
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
        <p className="text-sm">
          <Link className="accent hover:underline" to="/admin/reset-password">
            Forgot password?
          </Link>
        </p>
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
        <Route path="reset-password" element={<ResetPassword />} />
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
