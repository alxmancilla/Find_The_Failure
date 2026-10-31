// Spec checker: validates spec front matter and links, and reports which
// numbered requirements are referenced by automated tests.
//
// Tests reference requirements as `[<spec>:REQ-001]` or `[<spec>:REQ-001,REQ-002]`
// in test names or assertion messages.
//
// Usage: node scripts/spec-check.mjs [--strict]
//   --strict  also fail when a validated spec has requirements with no test reference.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SPECS = join(ROOT, "specs");
const TEST_ROOTS = ["scripts/full-smoke.mjs", "backend/smoke.mjs", "frontend/src"];
const STATUSES = ["draft", "accepted", "implemented", "validated", "superseded"];
const LINK_PAIRS = [["amends", "amended_by"], ["supersedes", "superseded_by"]];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const strict = process.argv.includes("--strict");

const errors = [];
const fail = (spec, msg) => errors.push(`${spec}: ${msg}`);

function parseFrontMatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const meta = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    meta[m[1]] = value.startsWith("[") ? value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean) : value;
  }
  return meta;
}

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const specNames = readdirSync(SPECS).filter((d) => existsSync(join(SPECS, d, "spec.md"))).sort();
const tags = new Set(execSync("git tag -l", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));
const specs = new Map();

for (const name of specNames) {
  const text = readFileSync(join(SPECS, name, "spec.md"), "utf8");
  const meta = parseFrontMatter(text);
  if (!meta) { fail(name, "front matter must start on line 1 (---)"); continue; }
  if (!STATUSES.includes(meta.status)) fail(name, `status "${meta.status}" is not one of ${STATUSES.join(", ")}`);
  for (const key of ["created", "updated"]) if (!DATE.test(meta[key] || "")) fail(name, `${key} must be YYYY-MM-DD`);
  if (meta.updated < meta.created) fail(name, "updated is earlier than created");
  if (!meta.baseline_tag) fail(name, "baseline_tag is required (a git tag or none)");
  else if (meta.baseline_tag !== "none" && !tags.has(meta.baseline_tag)) fail(name, `baseline_tag "${meta.baseline_tag}" is not a git tag`);

  const reqs = [...text.matchAll(/^- \*\*(REQ-\d{3}):\*\*/gm)].map((m) => m[1]);
  const dupes = reqs.filter((r, i) => reqs.indexOf(r) !== i);
  if (dupes.length) fail(name, `duplicate requirement IDs: ${[...new Set(dupes)].join(", ")}`);

  const criteria = text.split(/^## /m).find((s) => /^\d+\.\s*Acceptance criteria/.test(s)) || "";
  const open = (criteria.match(/^- \[ \]/gm) || []).length;
  if (meta.status === "validated" && open) fail(name, `validated but ${open} acceptance criteria are unchecked`);

  specs.set(name, { meta, reqs: new Set(reqs) });
}

for (const [name, { meta }] of specs) {
  for (const key of ["depends_on", ...LINK_PAIRS.flat()]) {
    for (const target of list(meta[key])) if (!specs.has(target)) fail(name, `${key} references unknown spec "${target}"`);
  }
  for (const [forward, back] of LINK_PAIRS) {
    for (const target of list(meta[forward])) {
      if (specs.has(target) && !list(specs.get(target).meta[back]).includes(name)) fail(name, `${forward} ${target}, but ${target} has no ${back}: [${name}]`);
    }
    for (const source of list(meta[back])) {
      if (specs.has(source) && !list(specs.get(source).meta[forward]).includes(name)) fail(name, `${back} ${source}, but ${source} has no ${forward}: [${name}]`);
    }
  }
  if (meta.status === "superseded" && !list(meta.superseded_by).length) fail(name, "status superseded requires superseded_by");
}

function testFiles(path) {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { recursive: true })
    .map((f) => join(abs, f))
    .filter((f) => /\.test\.jsx?$/.test(f));
}

const covered = new Map();
for (const file of TEST_ROOTS.flatMap(testFiles)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\[([a-z0-9-]+):(REQ-\d{3}(?:,\s*REQ-\d{3})*)\]/g)) {
    const spec = specs.get(m[1]);
    for (const req of m[2].split(",").map((s) => s.trim())) {
      if (!spec) { fail(relative(ROOT, file), `references unknown spec "${m[1]}"`); continue; }
      if (!spec.reqs.has(req)) { fail(relative(ROOT, file), `references unknown requirement ${m[1]}:${req}`); continue; }
      if (!covered.has(m[1])) covered.set(m[1], new Set());
      covered.get(m[1]).add(req);
    }
  }
}

console.log("Spec                              Status        Tested");
let uncoveredValidated = 0;
for (const [name, { meta, reqs }] of specs) {
  const hit = covered.get(name) || new Set();
  const missing = [...reqs].filter((r) => !hit.has(r));
  if (meta.status === "validated") uncoveredValidated += missing.length;
  const detail = reqs.size ? `${hit.size}/${reqs.size}${missing.length && hit.size ? `  untested: ${missing.join(", ")}` : ""}` : "no REQ IDs";
  console.log(`${name.padEnd(34)}${String(meta.status).padEnd(14)}${detail}`);
}

const totalReqs = [...specs.values()].reduce((n, s) => n + s.reqs.size, 0);
const totalHit = [...covered.values()].reduce((n, s) => n + s.size, 0);
console.log(`\n${totalHit}/${totalReqs} requirements referenced by automated tests.`);
if (errors.length) {
  console.log(`\n${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  errors.forEach((e) => console.log(`  - ${e}`));
}
if (strict && uncoveredValidated) console.log(`\n--strict: ${uncoveredValidated} requirements in validated specs have no test reference.`);
process.exit(errors.length || (strict && uncoveredValidated) ? 1 : 0);
