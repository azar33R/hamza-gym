// Audit i18n placeholder agreement.
//
// Two failure modes this catches:
//   1. A key referenced with t() but missing from the dictionary.
//   2. A key that EXISTS, but whose {placeholders} are never supplied at any
//      call site — which renders a literal "{when}" on screen.
//
// Placeholders are resolved per KEY (union across every call site), because a
// key is often called from several places or from per-locale branches that pass
// different variables. Only flags a placeholder that NO call site ever supplies.
const fs = require("fs");
const path = require("path");
const root = process.cwd();

const dicts = {};
for (const loc of ["ar", "en"]) {
  dicts[loc] = JSON.parse(fs.readFileSync(path.join(root, `messages/${loc}.json`), "utf8"));
}

const skip = new Set(["node_modules", ".next", ".git", "messages", "out", "scripts"]);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(root);

// key -> { passed:Set, sites:[] }
const byKey = new Map();
const keyRe = /\bt\(\s*["'`]([a-zA-Z0-9_.\-]+)["'`]/g;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  keyRe.lastIndex = 0;
  let m;
  while ((m = keyRe.exec(src))) {
    const key = m[1];
    if (!byKey.has(key)) byKey.set(key, { passed: new Set(), sites: new Set() });
    byKey.get(key).sites.add(path.relative(root, f));
  }
}

// Second pass: harvest variable names from t("key", { ... }) argument objects.
const callRe = /\bt\(\s*(?:"|'|`)([a-zA-Z0-9_.\-]+)(?:"|'|`)\s*,\s*\{/g;
function splitTopLevel(src) {
  const out = [];
  let depth = 0, buf = "", inStr = null;
  for (const ch of src) {
    if (inStr) {
      buf += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; buf += ch; continue; }
    if ("{[(".includes(ch)) depth++;
    else if ("]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  callRe.lastIndex = 0;
  let m;
  while ((m = callRe.exec(src))) {
    const key = m[1];
    const entry = byKey.get(key);
    if (!entry) continue;
    // Grab the balanced {...} that follows.
    let i = callRe.lastIndex, depth = 1, inStr = null;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (inStr) { if (ch === inStr && src[i - 1] !== "\\") inStr = null; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    const body = src.slice(callRe.lastIndex, i - 1);
    for (const part of splitTopLevel(body)) {
      const name = part.split(":")[0].trim().replace(/^\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(name)) entry.passed.add(name);
    }
  }
}

const problems = [];
const warnings = [];

for (const loc of ["ar", "en"]) {
  for (const [key, entry] of byKey) {
    const val = dicts[loc][key];
    if (typeof val !== "string") {
      problems.push({ kind: "MISSING KEY", loc, key, detail: "not in dictionary", sites: [...entry.sites] });
      continue;
    }
    const needed = [...new Set([...val.matchAll(/\{(\w+)\}/g)].map((x) => x[1]))];
    const never = needed.filter((n) => !entry.passed.has(n));
    const extra = [...entry.passed].filter((n) => !needed.includes(n));
    if (never.length) {
      problems.push({ kind: "UNSUPPLIED", loc, key, detail: `string uses {${never.join("}, {")}} but no call site passes it -> renders raw`, sites: [...entry.sites] });
    } else if (extra.length) {
      warnings.push({ loc, key, detail: `passes {${extra.join("}, {")}} but the string has no such placeholder (ignored)`, sites: [...entry.sites] });
    }
  }
}

console.log(`Checked ${byKey.size} referenced keys.\n`);
if (problems.length) {
  console.log(`ERRORS (${problems.length}):`);
  for (const p of problems) {
    console.log(`  [${p.kind}] ${p.loc}  ${p.key}`);
    console.log(`      ${p.detail}`);
    console.log(`      ${p.sites.slice(0, 3).join(", ")}\n`);
  }
} else {
  console.log("OK - every referenced key exists and all its placeholders are supplied.");
}
if (warnings.length) {
  console.log(`\nNotes (${warnings.length}) - harmless extra variables:`);
  for (const w of warnings) console.log(`  ${w.loc}  ${w.key}: ${w.detail}`);
}
process.exitCode = problems.length ? 1 : 0;
