// Dev-only audit: find every t("key") literal in the source and report keys
// missing from messages/ar.json or messages/en.json.
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const ar = JSON.parse(fs.readFileSync(path.join(root, "messages/ar.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"));

const skip = new Set(["node_modules", ".next", ".git", "messages", "out"]);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(root);

const re = /\bt\(\s*["'`]([a-zA-Z0-9_.\-]+)["'`]/g;
const missingAr = new Map();
const missingEn = new Map();

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const k = m[1];
    if (!(k in ar)) {
      if (!missingAr.has(k)) missingAr.set(k, []);
      missingAr.get(k).push(path.relative(root, f));
    }
    if (!(k in en)) {
      if (!missingEn.has(k)) missingEn.set(k, []);
      missingEn.get(k).push(path.relative(root, f));
    }
  }
}

const show = (label, map) => {
  console.log(`\n=== missing in ${label}: ${map.size} ===`);
  for (const [k, fs_] of [...map].sort()) {
    console.log(`  ${k}  <- ${[...new Set(fs_)].slice(0, 3).join(", ")}`);
  }
};
show("ar.json", missingAr);
show("en.json", missingEn);

// Unused keys (informational)
const used = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) used.add(m[1]);
}
const unusedAr = Object.keys(ar).filter((k) => !used.has(k));
console.log(`\n=== defined in ar.json but never referenced: ${unusedAr.length} ===`);
console.log("  " + unusedAr.slice(0, 40).join("\n  "));
