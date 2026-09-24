#!/usr/bin/env node
// Adds shadcn/ui components by fetching their source straight from the
// shadcn-ui GitHub repo (new-york-v4 registry). Use this where ui.shadcn.com
// is not reachable (e.g. cloud sandboxes); elsewhere `npx shadcn add` works too.
//
// Usage: npm run ui:add -- card dialog table

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REF = process.env.SHADCN_REF ?? "main";
const BASE = `https://raw.githubusercontent.com/shadcn-ui/ui/${REF}/apps/v4/registry/new-york-v4`;
const ROOT = process.cwd();

// Registry file path prefix → project directory
const TARGETS = { "ui/": "components/ui/", "hooks/": "hooks/", "lib/": "lib/" };

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

// _registry.ts is a TS array literal; pull out one item's fields with regexes.
function parseItem(registry, name) {
  const start = registry.indexOf(`name: "${name}",`);
  if (start === -1) return null;
  const end = registry.indexOf("\n  {\n    name:", start);
  const block = registry.slice(start, end === -1 ? undefined : end);
  const list = (key) => {
    const m = block.match(new RegExp(`${key}: \\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  };
  const files = [...block.matchAll(/path: "([^"]+)"/g)].map((x) => x[1]);
  return {
    dependencies: list("dependencies"),
    registryDependencies: list("registryDependencies"),
    files,
  };
}

function rewriteImports(source) {
  return source
    .replace(/from "cn"/g, 'from "@/lib/utils"')
    .replace(/@\/registry\/new-york-v4\/ui\//g, "@/components/ui/")
    .replace(/@\/registry\/new-york-v4\/hooks\//g, "@/hooks/")
    .replace(/@\/registry\/new-york-v4\/lib\//g, "@/lib/");
}

function targetPath(file) {
  const prefix = Object.keys(TARGETS).find((p) => file.startsWith(p));
  if (!prefix) throw new Error(`Unsupported registry file path: ${file}`);
  return join(ROOT, TARGETS[prefix], file.slice(prefix.length));
}

const requested = process.argv.slice(2);
if (requested.length === 0) {
  console.error("Usage: npm run ui:add -- <component> [component...]");
  process.exit(1);
}

const registries = await Promise.all(
  ["ui", "hooks", "lib"].map((dir) =>
    fetchText(`${BASE}/${dir}/_registry.ts`).catch(() => ""),
  ),
);
const registry = registries.join("\n");

const queue = [...requested];
const seen = new Set();
const npmDeps = new Set();
const written = [];

while (queue.length > 0) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  if (name === "utils") continue; // lib/utils.ts (cn) already exists

  const item = parseItem(registry, name);
  if (!item)
    throw new Error(`Component "${name}" not found in the shadcn registry`);

  item.dependencies.forEach((d) => npmDeps.add(d));
  queue.push(...item.registryDependencies);

  for (const file of item.files) {
    const dest = targetPath(file);
    // Only overwrite components the user asked for explicitly
    if (existsSync(dest) && !requested.includes(name)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, rewriteImports(await fetchText(`${BASE}/${file}`)));
    written.push(dest);
  }
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const installed = { ...pkg.dependencies, ...pkg.devDependencies };
const missing = [...npmDeps].filter(
  (d) => !installed[d.replace(/(.)@.*$/, "$1")],
);
if (missing.length > 0) {
  console.log(`Installing: ${missing.join(" ")}`);
  execFileSync("npm", ["install", ...missing], { stdio: "inherit" });
}

if (written.length > 0) {
  execFileSync("npx", ["prettier", "--write", ...written], {
    stdio: "inherit",
  });
}
console.log(
  `Added: ${written.map((f) => f.slice(ROOT.length + 1)).join(", ") || "nothing new"}`,
);
