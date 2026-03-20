import { lookupNpcFr } from "../lib/wowhead.js";
import { loadNpcCache, saveNpcCache, getCachedNpc, setCachedNpc } from "../lib/npc-cache.js";
import { DELAY, sleep } from "./config.js";

const npcCache = loadNpcCache();

export async function resolveNpcFr(englishName) {
  const cached = getCachedNpc(npcCache, englishName, "fr");
  if (cached) {
    console.log(`  -> [NPC CACHE] ${cached}`);
    return cached;
  }
  if (DELAY > 0) await sleep(DELAY);
  const frName = await lookupNpcFr(englishName);
  if (frName) {
    setCachedNpc(npcCache, englishName, "fr", frName);
  }
  return frName;
}

export function saveNpcCacheToDisk() {
  saveNpcCache(npcCache);
}
