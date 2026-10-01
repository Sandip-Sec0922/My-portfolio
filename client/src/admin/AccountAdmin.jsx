import { useState } from "react";
import { api } from "../api/client.js";
import { usePageTitle } from "../hooks.js";
import { useAuth } from "./auth.jsx";
import { Field } from "./ui.jsx";

export default function AccountAdmin() {
  usePageTitle("Admin: account");
  const { user, fail, expire } = useAuth();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev) {
    ev.preventDefault();
    setErr("");
    if (next !== again) return setErr("The new passwords do not match.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: cur,
        newPassword: next,
      });
      // The server revoked every session (including this one) and cleared the cookies.
      expire(
        "Password changed. All sessions were signed out. Sign in with the new password.",
      );
    } catch (e) {
      setErr(fail(e));
      setBusy(false);
    }
    return undefined;
  }

  return (
    <section aria-labelledby="ac" className="max-w-md">
      <h1 id="ac" className="mb-1 text-2xl">
        Account
      </h1>
      <p className="mb-4 text-sm">
        Signed in as{" "}
        <span className="font-mono">{user?.email || user?.role}</span>
      </p>
      <form onSubmit={submit} className="glass space-y-4">
        <h2 className="text-lg">Change password</h2>
        <Field id="cur" label="Current password">
          <input
            id="cur"
            type="password"
            required
            autoComplete="current-password"
            maxLength={128}
            className="input"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
          />
        </Field>
        <Field
          id="next"
          label="New password"
          hint="At least 14 characters. A passphrase from a password manager is ideal."
        >
          <input
            id="next"
            type="password"
            required
            minLength={14}
            maxLength={128}
            autoComplete="new-password"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field id="again" label="Repeat new password">
          <input
            id="again"
            type="password"
            required
            minLength={14}
            maxLength={128}
            autoComplete="new-password"
            className="input"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </Field>
        <button className="btn btn-solid" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {err}
        </p>
      </form>
    </section>
  );
}
