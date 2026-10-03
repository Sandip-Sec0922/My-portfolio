import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://www.sandipkepchhaki.com.np";

export const ROUTE_METADATA = {
  "/": {
    title: "Cybersecurity & Security Automation",
    description:
      "Sandip Kepchhaki's cybersecurity portfolio: security automation, SOC learning, projects, and practical write-ups.",
  },
  "/projects": {
    title: "Cybersecurity Projects",
    description:
      "Explore Sandip Kepchhaki's cybersecurity projects, security notes, and public GitHub repositories.",
  },
  "/lab": {
    title: "SOC Lab",
    description:
      "Explore the planned home-lab design, detection workflow, and incident reports from Sandip Kepchhaki.",
  },
  "/roadmap": {
    title: "SOC Analyst Learning Roadmap",
    description:
      "Follow Sandip Kepchhaki's learning roadmap for SOC analysis, security operations, and practical detection skills.",
  },
  "/blog": {
    title: "Cybersecurity Write-ups",
    description:
      "Read cybersecurity investigations, technical notes, and lessons from Sandip Kepchhaki.",
  },
  "/security": {
    title: "Portfolio Security Posture",
    description:
      "An overview of the security controls and aggregate security-event telemetry used by Sandip Kepchhaki's portfolio.",
  },
  "/contact": {
    title: "Contact Sandip Kepchhaki",
    description:
      "Contact Sandip Kepchhaki about cybersecurity, SOC analyst opportunities, projects, and collaboration.",
  },
  "/admin/login": {
    title: "Admin Sign In",
    description: "Private administration area.",
    robots: "noindex,nofollow",
  },
  "/admin/reset-password": {
    title: "Reset Admin Password",
    description: "Private administration area.",
    robots: "noindex,nofollow",
  },
};

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

function setMeta(html, attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = new RegExp(
    `<meta\\s+[^>]*\\b${attribute}=["']${escapedKey}["'][^>]*>`,
    "i",
  );
  const replacement = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  if (tag.test(html)) return html.replace(tag, () => replacement);
  return html.replace(/<\/head>/i, `  ${replacement}\n  </head>`);
}

function setCanonical(html, url) {
  const tag = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  const replacement = `<link rel="canonical" href="${escapeHtml(url)}" />`;
  if (tag.test(html)) return html.replace(tag, () => replacement);
  return html.replace(/<\/head>/i, `  ${replacement}\n  </head>`);
}

export function renderRouteDocument(template, route, metadata) {
  const title = `${metadata.title} | Sandip Kepchhaki`;
  const canonical = new URL(route, SITE_URL).href;
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, () =>
    `<title>${escapeHtml(title)}</title>`,
  );
  html = setMeta(html, "name", "description", metadata.description);
  html = setMeta(html, "property", "og:type", "website");
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", metadata.description);
  html = setMeta(html, "property", "og:url", canonical);
  html = setMeta(
    html,
    "property",
    "og:image",
    `${SITE_URL}/og-image.png`,
  );
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", metadata.description);
  html = setCanonical(html, canonical);
  if (metadata.robots) {
    html = setMeta(html, "name", "robots", metadata.robots);
  }
  return html;
}

async function generateRouteDocuments() {
  const projectDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const outputDirectory = path.join(projectDirectory, "dist");
  const template = await readFile(path.join(outputDirectory, "index.html"), "utf8");

  await Promise.all(
    Object.entries(ROUTE_METADATA).map(async ([route, metadata]) => {
      const relativePath = route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
      const destination = path.join(outputDirectory, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(
        destination,
        renderRouteDocument(template, route, metadata),
      );
    }),
  );
}

const scriptPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : "";
if (scriptPath === fileURLToPath(import.meta.url)) {
  await generateRouteDocuments();
}
