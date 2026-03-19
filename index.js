import { readFileSync, writeFileSync, existsSync } from "fs";
import { lookupNpcFr } from "./wowhead.js";
import { loadNpcCache, saveNpcCache, getCachedNpc, setCachedNpc } from "./npc-cache.js";
import { PREFIXES, SUFFIXES } from "./keys.js";

const API_KEY = process.env.TRANSLATION_API_KEY;
if (!API_KEY) {
  console.error("Missing TRANSLATION_API_KEY in .env");
  process.exit(1);
}

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
const DELAY = parseInt(process.env.DELAY_BETWEEN_REQUESTS || "500", 10);
const CACHE_FILE = "translation-cache.json";
const BASE_URL = "https://translation-hub.darkuniverse.work/api/v1";
const LOCALE = "frFR";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const npcCache = loadNpcCache();

const MODE = process.argv[2] || "safe";

async function resolveNpcFr(englishName) {
  const cached = getCachedNpc(npcCache, englishName, "fr");
  if (cached) {
    console.log(`  -> [NPC CACHE] ${cached}`);
    return cached;
  }
  const frName = await lookupNpcFr(englishName);
  if (frName) {
    setCachedNpc(npcCache, englishName, "fr", frName);
  }
  return frName;
}

function parseEntry(text) {
  for (const prefix of PREFIXES) {
    if (!text.startsWith(prefix.en + " ")) continue;

    let rest = text.slice(prefix.en.length + 1);
    let suffixFr = "";

    for (const suffix of SUFFIXES) {
      if (rest.endsWith(suffix.en)) {
        rest = rest.slice(0, -suffix.en.length).trimEnd();
        suffixFr = ` ${suffix.fr}`;
        break;
      }
    }

    return { npcName: rest, prefixFr: prefix.fr, suffixFr };
  }
  return null;
}

async function api(path, options = {}) {
  const { method = "GET", body } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function getContext(translationId) {
  const params = new URLSearchParams({ locale: LOCALE });
  return api(`/translations/${translationId}/context?${params}`);
}

async function searchTranslations(query, limit = 100) {
  const params = new URLSearchParams({ q: query, locale: LOCALE, limit });
  return api(`/translations/search?${params}`);
}

async function submitTranslation(translationId, value) {
  return api("/account/submissions", {
    method: "POST",
    body: {
      translation_id: translationId,
      locale: LOCALE,
      value,
      submission_comment: "Submitted with 'trollzcrank firstToSlay' script",
    },
  });
}

function loadCache() {
  if (!existsSync(CACHE_FILE)) return [];
  return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
}

function saveCache(entries) {
  writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2));
}

async function cacheMode() {
  console.log("Fetching 'First to slay' entries...");
  const { results } = await searchTranslations("First to slay", BATCH_SIZE);
  console.log(`Found ${results.length} entries\n`);

  const cache = loadCache();
  const existingIds = new Set(cache.map((e) => e.id));

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of results) {
    if (existingIds.has(entry.id)) {
      console.log(`[SKIP] Already in cache: ${entry.id}`);
      skipped++;
      continue;
    }

    const parsed = parseEntry(entry.enUS);
    if (!parsed) {
      console.log(`[SKIP] No pattern match: "${entry.enUS}"`);
      skipped++;
      continue;
    }

    const { npcName, prefixFr, suffixFr } = parsed;

    console.log(`[${entry.id}] Looking up "${npcName}"...`);
    const npcNameFr = await resolveNpcFr(npcName);

    if (!npcNameFr) {
      console.log(`  -> NPC not found on Wowhead, skipping`);
      failed++;
      continue;
    }

    const translation = `${prefixFr} ${npcNameFr}${suffixFr}`;
    console.log(`  -> ${translation}`);

    cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
    added++;

    if (DELAY > 0) await sleep(DELAY);
  }

  saveCache(cache);
  saveNpcCache(npcCache);
  console.log(`\nDone! Added to cache: ${added}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total in cache: ${cache.length}`);
}

async function safeMode() {
  console.log("[SAFE] Fetching 'First to slay' entries...");
  const { results } = await searchTranslations("First to slay", BATCH_SIZE);
  console.log(`Found ${results.length} entries\n`);

  const cache = loadCache();
  const existingIds = new Set(cache.map((e) => e.id));

  let submitted = 0;
  let cached = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of results) {
    if (existingIds.has(entry.id)) {
      console.log(`[SKIP] Already in cache: ${entry.id}`);
      skipped++;
      continue;
    }

    const parsed = parseEntry(entry.enUS);
    if (!parsed) {
      console.log(`[SKIP] No pattern match: "${entry.enUS}"`);
      skipped++;
      continue;
    }

    const { npcName, prefixFr, suffixFr } = parsed;

    console.log(`[${entry.id}] Looking up "${npcName}"...`);
    const npcNameFr = await resolveNpcFr(npcName);

    if (!npcNameFr) {
      console.log(`  -> NPC not found on Wowhead, skipping`);
      failed++;
      continue;
    }

    const translation = `${prefixFr} ${npcNameFr}${suffixFr}`;
    console.log(`  -> ${translation}`);

    // Check if entry already has a translation in the DB
    const ctx = await getContext(entry.id);
    const hasOutput = ctx.output && ctx.output.trim() !== "";

    if (!hasOutput) {
      // No existing translation — submit directly
      try {
        const res = await submitTranslation(entry.id, translation);
        console.log(`  -> [SUBMIT] Done!`, JSON.stringify(res));
        submitted++;
      } catch (err) {
        console.log(`  -> [SUBMIT] Failed: ${err.message}`);
        cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
        cached++;
      }
    } else {
      // Existing translation — cache for later
      console.log(`  -> [CACHE] Output exists: "${ctx.output}"`);
      cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
      cached++;
    }

    if (DELAY > 0) await sleep(DELAY);
  }

  saveCache(cache);
  saveNpcCache(npcCache);
  console.log(`\nDone! Submitted: ${submitted}, Cached: ${cached}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total in cache: ${cache.length}`);
}

async function submitMode() {
  const cache = loadCache();
  if (cache.length === 0) {
    console.log("Cache is empty. Run with 'cache' mode first.");
    return;
  }

  console.log(`Submitting ${cache.length} cached translations...\n`);

  let submitted = 0;
  let failed = 0;
  const remaining = [];

  for (const entry of cache) {
    console.log(`[${entry.id}] ${entry.frFR}`);
    try {
      const res = await submitTranslation(entry.id, entry.frFR);
      console.log(`  -> Submitted!`, JSON.stringify(res));
      submitted++;
    } catch (err) {
      console.log(`  -> Failed: ${err.message}`);
      remaining.push(entry);
      failed++;
    }

    if (DELAY > 0) await sleep(DELAY);
  }

  saveCache(remaining);
  console.log(`\nDone! Submitted: ${submitted}, Failed: ${failed}`);
  if (remaining.length > 0) {
    console.log(`${remaining.length} entries still in cache (failed)`);
  }
}

async function main() {
  if (MODE === "safe") {
    await safeMode();
  } else if (MODE === "cache") {
    await cacheMode();
  } else if (MODE === "submit") {
    await submitMode();
  } else {
    console.error(`Unknown mode: "${MODE}". Use "safe", "cache" or "submit".`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
