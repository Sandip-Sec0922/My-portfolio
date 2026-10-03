import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderRouteDocument,
  ROUTE_METADATA,
} from "./generate-route-documents.mjs";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const template = `<!doctype html>
<html><head>
<title>Generic portfolio title</title>
<meta name="description" content="Generic description" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Generic title" />
<meta property="og:description" content="Generic description" />
<meta property="og:url" content="https://www.sandipkepchhaki.com.np" />
<meta property="og:image" content="https://www.sandipkepchhaki.com.np/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Generic title" />
<meta name="twitter:description" content="Generic description" />
<link rel="canonical" href="https://www.sandipkepchhaki.com.np" />
</head><body><div id="root"></div></body></html>`;

test("public route document has route-specific metadata and canonical URL", () => {
  const html = renderRouteDocument(template, "/projects", ROUTE_METADATA["/projects"]);

  assert.match(html, /<title>Cybersecurity Projects \| Sandip Kepchhaki<\/title>/);
  assert.match(html, /name="description" content="Explore Sandip Kepchhaki&#39;s/);
  assert.match(
    html,
    /property="og:url" content="https:\/\/www\.sandipkepchhaki\.com\.np\/projects"/,
  );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/www\.sandipkepchhaki\.com\.np\/projects" \/>/,
  );
  assert.match(html, /<div id="root"><\/div>/);
});

test("admin route document is marked noindex before the app hydrates", () => {
  const html = renderRouteDocument(
    template,
    "/admin/login",
    ROUTE_METADATA["/admin/login"],
  );

  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/www\.sandipkepchhaki\.com\.np\/admin\/login" \/>/,
  );
});

test("metadata values are HTML-escaped", () => {
  const html = renderRouteDocument(template, "/blog", {
    title: "Research & notes",
    description: 'A "safe" description',
  });

  assert.match(html, /<title>Research &amp; notes \| Sandip Kepchhaki<\/title>/);
  assert.match(html, /name="description" content="A &quot;safe&quot; description"/);
});

test("Vercel serves each generated route document before the SPA fallback", async () => {
  const config = JSON.parse(
    await readFile(path.join(projectDirectory, "vercel.json"), "utf8"),
  );
  const rewrites = config.rewrites;

  for (const route of Object.keys(ROUTE_METADATA).filter((path) => path !== "/")) {
    const destination = `/${route.slice(1)}/index.html`;
    assert.ok(
      rewrites.some(
        (rewrite) =>
          rewrite.source === route && rewrite.destination === destination,
      ),
      `Expected Vercel rewrite for ${route} to ${destination}`,
    );
  }
  assert.equal(rewrites.at(-1).source, "/(.*)");
  assert.equal(rewrites.at(-1).destination, "/");
});
