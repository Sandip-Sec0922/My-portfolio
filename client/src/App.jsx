import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
} from "framer-motion";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { profile } from "./data/profile.js";
import Home from "./pages/Home.jsx";

const links = [
  ["/", "Home"],
  ["/projects", "Projects"],
  ["/lab", "Lab"],
  ["/roadmap", "Roadmap"],
  ["/blog", "Blog"],
  ["/security", "Security"],
  ["/contact", "Contact"],
];
const primaryLinks = [
  ["/projects", "Work"],
  ["/lab", "Lab"],
  ["/blog", "Writing"],
  ["/#about", "About"],
];
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
const Projects = lazy(() => import("./pages/Projects.jsx"));
const Lab = lazy(() => import("./pages/Lab.jsx"));
const Roadmap = lazy(() => import("./pages/Roadmap.jsx"));
const BlogList = lazy(() =>
  import("./pages/Blog.jsx").then((module) => ({ default: module.BlogList })),
);
const BlogPost = lazy(() =>
  import("./pages/Blog.jsx").then((module) => ({ default: module.BlogPost })),
);
const Security = lazy(() => import("./pages/Security.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // The theme still changes for this visit when storage is unavailable.
    }
    setDark(next);
  };

  return (
    <button
      className="btn !min-h-9 !rounded-full !px-3"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <span aria-hidden="true" className="text-base">
        {dark ? "☼" : "◐"}
      </span>
      <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const input = useRef(null);
  const navigate = useNavigate();
  const choices = useMemo(
    () =>
      links.filter(([, label]) =>
        label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      input.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/60 px-4 pt-[15vh] backdrop-blur-sm"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl dark:bg-slate-900"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = [
            ...event.currentTarget.querySelectorAll(
              'input:not([disabled]), button:not([disabled])',
            ),
          ];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2 id="command-title" className="sr-only">
          Navigate to a page
        </h2>
        <label className="sr-only" htmlFor="command-search">
          Search pages
        </label>
        <input
          id="command-search"
          ref={input}
          className="input !rounded-none !border-0 border-b !bg-transparent"
          placeholder="Search pages…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {choices.length ? (
            choices.map(([to, label]) => (
              <li key={to}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-100 focus:bg-slate-100 dark:hover:bg-white/10 dark:focus:bg-white/10"
                  onClick={() => {
                    onClose(false);
                    navigate(to);
                  }}
                >
                  {label}
                  <span className="font-mono text-xs text-slate-400">{to}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-6 text-center text-sm text-slate-500">
              No matching pages
            </li>
          )}
        </ul>
        <p className="border-t border-slate-200 px-4 py-2 font-mono text-[10px] text-slate-500 dark:border-white/10">
          ESC TO CLOSE
        </p>
      </motion.div>
    </motion.div>
  );
}

function NotFound() {
  return (
    <div className="glass mx-auto max-w-xl text-center">
      <p className="eyebrow">404 / Route not found</p>
      <h1 className="mt-3 text-4xl">This path is off the map.</h1>
      <p className="prose-copy mt-3">
        The page may have moved, or the URL may be incorrect.
      </p>
      <Link className="btn btn-solid mt-6" to="/">
        Return home
      </Link>
    </div>
  );
}

function PageRoutes() {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Suspense
        fallback={
          <div className="glass animate-pulse" role="status">
            Loading page…
          </div>
        }
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </motion.div>
  );
}

function SiteLayout() {
  const location = useLocation();
  const mainRef = useRef(null);
  const mobileNavButtonRef = useRef(null);
  const paletteReturnFocusRef = useRef(null);
  const previousPath = useRef(location.pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const closePalette = (restoreFocus = true) => {
    setPaletteOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => paletteReturnFocusRef.current?.focus());
    }
  };

  useEffect(() => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    if (location.hash) {
      window.setTimeout(() => {
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView({ behavior, block: "start" });
      }, 0);
    } else {
      window.scrollTo({ top: 0, behavior });
    }
    if (previousPath.current !== location.pathname) {
      mainRef.current?.focus({ preventScroll: true });
      previousPath.current = location.pathname;
    }
    setMobileOpen(false);
    setPaletteOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const openPalette = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        paletteReturnFocusRef.current = document.activeElement;
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", openPalette);
    return () => window.removeEventListener("keydown", openPalette);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      mobileNavButtonRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-slate-950"
      >
        Skip to content
      </a>
      <div className="site-shell min-h-screen">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-950/75">
          <nav
            aria-label="Main"
            className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6"
          >
            <Link to="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-600/20 bg-teal-500/10 font-mono font-bold text-teal-700 dark:text-teal-300">
                SK
              </span>
              <span className="header-brand-copy leading-tight">
                <span className="block text-sm font-semibold">Sandip</span>
                <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  SECURITY PORTFOLIO
                </span>
              </span>
            </Link>

            <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
              {primaryLinks.map(([to, label]) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/#about"}
                    className={({ isActive }) =>
                      `relative rounded-lg px-3 py-2 text-[13px] transition ${isActive ? "font-medium text-teal-800 dark:text-teal-200" : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {label}
                        {isActive && (
                          <motion.span
                            layoutId="nav-indicator"
                            className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-teal-600 dark:bg-teal-300"
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <a className="btn btn-solid hidden !min-h-9 !rounded-full !px-4 sm:inline-flex" href="/resume.pdf" download>
                Resume
              </a>
              <button
                className="btn hidden !min-h-9 !rounded-full !px-3 text-xs sm:inline-flex"
                onClick={(event) => {
                  paletteReturnFocusRef.current = event.currentTarget;
                  setPaletteOpen(true);
                }}
                aria-label="Open page search"
              >
                <span>⌕</span>
                <span className="hidden xl:inline">Search</span>
                <kbd className="hidden rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-white/15 xl:inline">
                  Ctrl K
                </kbd>
              </button>
              <ThemeToggle />
              <button
                ref={mobileNavButtonRef}
                className="btn !min-h-9 !rounded-full !px-3 lg:hidden"
                aria-expanded={mobileOpen}
                aria-controls={mobileOpen ? "mobile-navigation" : undefined}
                aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
                onClick={() => setMobileOpen((value) => !value)}
              >
                <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
              </button>
            </div>
          </nav>
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                id="mobile-navigation"
                className="border-t border-slate-200 bg-white/95 px-4 py-3 dark:border-white/10 dark:bg-slate-950/95 lg:hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-1 sm:grid-cols-3">
                  {links.map(([to, label]) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={to === "/"}
                        className={({ isActive }) =>
                          `block rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-teal-500/10 font-medium text-teal-800 dark:text-teal-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`
                        }
                      >
                        {label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl px-3 py-2 text-left font-mono text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                  onClick={(event) => {
                    paletteReturnFocusRef.current = event.currentTarget;
                    setMobileOpen(false);
                    setPaletteOpen(true);
                  }}
                >
                  Search pages · Ctrl K
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="mx-auto min-h-[calc(100vh-10rem)] max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16"
        >
          <PageRoutes />
        </main>

        <footer className="border-t border-slate-200/80 bg-white/40 dark:border-white/[0.08] dark:bg-slate-950/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-semibold">Sandip Kepchhaki</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Learning, building, and documenting security work.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 font-mono text-xs">
              <a className="accent hover:underline" href={profile.github} rel="noopener noreferrer">
                GitHub ↗
              </a>
              <a className="accent hover:underline" href={profile.linkedin} rel="noopener noreferrer">
                LinkedIn ↗
              </a>
              <a className="accent hover:underline" href="/.well-known/security.txt">
                security.txt
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-400">© {new Date().getFullYear()}</p>
          </div>
        </footer>
        {paletteOpen && (
          <CommandPalette
            open={paletteOpen}
            onClose={closePalette}
          />
        )}
      </div>
    </MotionConfig>
  );
}

export default function App() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) {
    return (
      <Suspense
        fallback={
          <main className="mx-auto max-w-6xl px-4 py-10" role="status">
            Loading admin workspace…
          </main>
        }
      >
        <AdminApp />
      </Suspense>
    );
  }
  return <SiteLayout />;
}
