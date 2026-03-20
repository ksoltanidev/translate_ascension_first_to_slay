#!/usr/bin/env node

import { lookupNpc } from "./lib/wowhead.js";
import { loadNpcCache, saveNpcCache, getCachedNpc, setCachedNpc } from "./lib/npc-cache.js";

const name = process.argv[2];
const locale = process.argv[3] || "fr";

if (!name) {
  console.error('Usage: node npc.js "<NPC name>" [locale]');
  console.error('Example: node npc.js "Lord Darkscythe" de');
  process.exit(1);
}

const cache = loadNpcCache();
const cached = getCachedNpc(cache, name, locale);

if (cached) {
  console.log(cached);
  process.exit(0);
}

const translated = await lookupNpc(name, locale);

if (!translated) {
  console.error(`NPC "${name}" not found on Wowhead`);
  process.exit(1);
}

setCachedNpc(cache, name, locale, translated);
saveNpcCache(cache);

console.log(translated);
