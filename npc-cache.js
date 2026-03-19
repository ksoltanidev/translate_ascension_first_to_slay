import { readFileSync, writeFileSync, existsSync } from "fs";

const NPC_CACHE_FILE = "npc-cache.json";

export function loadNpcCache() {
  if (!existsSync(NPC_CACHE_FILE)) return {};
  return JSON.parse(readFileSync(NPC_CACHE_FILE, "utf-8"));
}

export function saveNpcCache(cache) {
  writeFileSync(NPC_CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Get a cached NPC name for a given locale.
 * Returns the name string or null if not cached.
 */
export function getCachedNpc(cache, englishName, locale) {
  return cache[englishName]?.[locale] ?? null;
}

/**
 * Store an NPC name in cache for a given locale.
 */
export function setCachedNpc(cache, englishName, locale, translatedName) {
  if (!cache[englishName]) {
    cache[englishName] = { en: englishName };
  }
  cache[englishName][locale] = translatedName;
}
