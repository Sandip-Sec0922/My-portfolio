import { lazy, Suspense, useEffect, useState } from "react";
import Lab from "./pages/Lab.jsx";
import Roadmap from "./pages/Roadmap.jsx";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { profile } from "./data/profile.js";
import Home from "./pages/Home.jsx";
import Projects from "./pages/Projects.jsx";
import { BlogList, BlogPost } from "./pages/Blog.jsx";
import Contact from "./pages/Contact.jsx";
import Security from "./pages/Security.jsx";

const links = [
  ["/", "Home"],
  ["/projects", "Projects"],
  ["/lab", "Lab"],
  ["/roadmap", "Roadmap"],
  ["/blog", "Blog"],
  ["/security", "Security"],
  ["/contact", "Contact"],
];
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
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
      /* storage may be blocked */
    }
    setDark(next);
  };
  return (
    <button
      className="btn"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      {dark ? "light" : "dark"}
    </button>
  );
}

function NotFound() {
  return (
    <div className="glass">
      <h1 className="text-2xl">404</h1>
      <p className="mt-2">
        Nothing here.{" "}
        <Link className="accent underline" to="/">
          Go home
        </Link>
      </p>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    // reducedMotion="user": every Framer Motion animation honours prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2 focus:text-black"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-300/70 bg-slate-50/80 backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3"
        >
          <Link to="/" className="font-mono font-bold accent">
            &gt;_ sandip
          </Link>
          <ul className="flex flex-1 flex-wrap gap-x-4 text-sm">
            {links.map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `py-1 hover:underline ${isActive ? "font-semibold accent" : ""}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <ThemeToggle />
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<p>Loading…</p>}>
                <AdminApp />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-300/70 py-6 text-center text-sm dark:border-white/10">
        <a
          className="accent underline"
          href={profile.github}
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        {" · "}
        <a
          className="accent underline"
          href={profile.linkedin}
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        {" · "}
        <a className="accent underline" href="/.well-known/security.txt">
          security.txt
        </a>
      </footer>
    </MotionConfig>
  );
}
