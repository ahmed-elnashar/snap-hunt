#!/usr/bin/env node
/**
 * Fails the build if key material reaches the shipped bundle.
 *
 * Run after `npx expo export --platform web` (which emits dist/client and,
 * because web.output is "server", dist/server). The client directory is what
 * ships to a device; a key there is a shipped credential.
 *
 * Two independent checks, because each catches something the other misses:
 *   1. Shape — anything that looks like an Anthropic key, wherever it appears.
 *   2. Identity — the literal value of ANTHROPIC_API_KEY if this process has
 *      one, which catches a key that was renamed or re-encoded on its way in.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';
const SKIP_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.mp3',
  '.wav',
  '.mp4',
  '.ico',
  '.zip',
  '.hbc',
]);

/** @type {{name: string, re: RegExp}[]} */
const PATTERNS = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{16,}/g },
  { name: 'Anthropic admin key', re: /sk-ant-admin[A-Za-z0-9_-]{16,}/g },
];

const liveKey = process.env.ANTHROPIC_API_KEY;
if (liveKey && liveKey.length >= 16) {
  PATTERNS.push({
    name: 'the value of ANTHROPIC_API_KEY in this environment',
    re: new RegExp(liveKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
  });
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (!SKIP_EXT.has(extname(full).toLowerCase())) out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error(`No ${DIST}/ directory. Run \`npx expo export --platform web\` first.`);
  process.exit(2);
}

const files = walk(DIST);
/** @type {string[]} */
const hits = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) hits.push(`${file}: ${name}`);
  }
}

if (hits.length > 0) {
  console.error('SECRET SCAN FAILED. Key material found in the bundle:');
  for (const hit of hits) console.error(`  ${hit}`);
  console.error('\nThe key belongs only in the server environment.');
  process.exit(1);
}

console.log(`Secret scan clean: ${files.length} bundled files, no key material.`);
