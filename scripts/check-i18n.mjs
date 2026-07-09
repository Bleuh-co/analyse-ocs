/**
 * Vérifie la parité stricte du dictionnaire i18n : chaque clé doit exister
 * dans les 3 langues (fr/en/es), sans clé orpheline ni valeur vide.
 *
 * Usage : node scripts/check-i18n.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const dictPath = join(here, "..", "src", "lib", "i18n-dict.ts");
const src = readFileSync(dictPath, "utf8");

// Transpile le module TS en JS puis évalue-le (module plat, sans dépendance).
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);
const MESSAGES = mod.MESSAGES;

const langs = ["fr", "en", "es"];
const keysets = Object.fromEntries(langs.map((l) => [l, new Set(Object.keys(MESSAGES[l] || {}))]));
let failed = false;

for (const a of langs) {
  for (const b of langs) {
    if (a === b) continue;
    const missing = [...keysets[a]].filter((k) => !keysets[b].has(k));
    if (missing.length) {
      failed = true;
      console.error(`✗ ${missing.length} clé(s) présentes en ${a} mais absentes en ${b} :`);
      for (const k of missing) console.error(`    ${k}`);
    }
  }
}

for (const l of langs) {
  const empty = Object.entries(MESSAGES[l]).filter(([, v]) => typeof v !== "string" || !v.trim());
  if (empty.length) {
    failed = true;
    console.error(`✗ valeurs vides en ${l} : ${empty.map(([k]) => k).join(", ")}`);
  }
}

if (failed) process.exit(1);
console.log(
  `✓ Parité i18n OK — ${keysets.fr.size} clés × ${langs.length} langues (${keysets.fr.size * langs.length} entrées).`,
);
