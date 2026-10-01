import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/client.js";
import { errText } from "./ui.jsx";

// UI state only. The real security decision is made by the API on every request (cookie + RBAC +
// CSRF), so tampering with this state in dev tools reveals empty screens and nothing else.
// The session check runs only under /admin: calling /auth/me for every public visitor would flood
// the Security Posture counters with auth_denied events.
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [s, setS] = useState({ status: "loading", user: null, notice: "" });

  useEffect(() => {
    let live = true;
    // api.get transparently tries one single-flight refresh if the access token expired.
    api
      .get("/auth/me")
      .then((d) => live && setS({ status: "in", user: d.user, notice: "" }))
      .catch(() => live && setS({ status: "out", user: null, notice: "" }));
    return () => {
      live = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post("/auth/login", { email, password });
    setS({ status: "in", user: d.user, notice: "" });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* cookies are cleared server-side even on partial failure */
    }
    setS({ status: "out", user: null, notice: "" });
  }, []);

  const expire = useCallback(
    (notice) => setS({ status: "out", user: null, notice }),
    [],
  );

  // Pages call fail(err) in catch blocks: a 401 that survived the refresh attempt means the session is
  // really gone, so bounce to the login screen. Returns a message to display.
  const fail = useCallback((e) => {
    if (e.status === 401)
      setS({
        status: "out",
        user: null,
        notice: "Your session expired. Please sign in again.",
      });
    return errText(e);
  }, []);

  const value = useMemo(
    () => ({ ...s, login, logout, expire, fail }),
    [s, login, logout, expire, fail],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
