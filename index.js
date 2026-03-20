import { readFileSync, writeFileSync, existsSync } from "fs";
import { lookupNpcFr } from "./wowhead.js";
import { loadNpcCache, saveNpcCache, getCachedNpc, setCachedNpc } from "./npc-cache.js";
import { SEARCH_GROUPS } from "./keys.js";

const API_KEY = process.env.TRANSLATION_API_KEY;
if (!API_KEY) {
  console.error("Missing TRANSLATION_API_KEY in .env");
  process.exit(1);
}

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
const DELAY = parseInt(process.env.DELAY_BETWEEN_REQUESTS || "500", 10);
const TREAT_SAME_AS_MISSING = process.env.TREAT_SAME_AS_MISSING === "true";
const SEARCH_GROUP_NAME = process.env.SEARCH_GROUP || "first-to-slay";
const GROUP = SEARCH_GROUPS[SEARCH_GROUP_NAME];
if (!GROUP) {
  console.error(`Unknown SEARCH_GROUP: "${SEARCH_GROUP_NAME}". Available: ${Object.keys(SEARCH_GROUPS).join(", ")}`);
  process.exit(1);
}
const CACHE_FILE = "translation-cache.json";
const ERRORS_FILE = "errors-cache.json";
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
  if (DELAY > 0) await sleep(DELAY);
  const frName = await lookupNpcFr(englishName);
  if (frName) {
    setCachedNpc(npcCache, englishName, "fr", frName);
  }
  return frName;
}

function parseEntry(text) {
  for (const prefix of GROUP.prefixes) {
    if (!text.startsWith(prefix.en + " ")) continue;

    let rest = text.slice(prefix.en.length + 1);
    let suffixFr = "";

    for (const suffix of GROUP.suffixes) {
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

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function api(path, options = {}) {
  const { method = "GET", body } = options;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 || res.status === 502 || res.status === 503) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "0", 10) * 1000;
        const wait = retryAfter || RETRY_DELAY * attempt;
        console.log(`  [API] ${res.status} — retrying in ${wait / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      if (err.message?.startsWith("API ")) throw err; // don't retry client errors (4xx)
      console.log(`  [API] ${err.message} — retrying in ${RETRY_DELAY * attempt / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY * attempt);
    }
  }
}

async function loadSubmittedIds() {
  const ids = new Set();
  let offset = 0;
  console.log("Loading pending submissions...");
  while (true) {
    const params = new URLSearchParams({ status: "pending", locale: LOCALE, limit: 100, offset });
    const data = await api(`/account/submissions?${params}`);
    for (const row of data.rows || []) {
      ids.add(row.translation_id);
    }
    if (!data.rows || data.rows.length < 100) break;
    offset += 100;
  }
  console.log(`Found ${ids.size} pending submissions to skip\n`);
  return ids;
}

async function searchTranslations(query, {
  limit = 100,
  offset = 0,
  table,
  include_untranslated = false,
  include_submission_status = false,
  treat_same_as_missing = false
} = {}) {
  const params = new URLSearchParams({
    q: query, locale: LOCALE, limit, offset,
    include_untranslated, include_submission_status, treat_same_as_missing,
  });
  if (table) params.set("table", table);
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

function loadErrors() {
  if (!existsSync(ERRORS_FILE)) return [];
  return JSON.parse(readFileSync(ERRORS_FILE, "utf-8"));
}

function saveErrors(entries) {
  writeFileSync(ERRORS_FILE, JSON.stringify(entries, null, 2));
}

async function cacheMode() {
  const cache = loadCache();
  const errors = loadErrors();
  const existingIds = new Set(cache.map((e) => e.id));
  const errorIds = new Set(errors.map((e) => e.id));

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const table of GROUP.tables) {
    let offset = 0;
    console.log(`\n=== [${SEARCH_GROUP_NAME}] Table: ${table} ===`);

    while (true) {
      console.log(`Fetching '${GROUP.query}' entries (offset=${offset})...`);
      const { results } = await searchTranslations(GROUP.query, {
        limit: BATCH_SIZE, offset, table,
        include_untranslated: true,
        treat_same_as_missing: TREAT_SAME_AS_MISSING,
      });
      console.log(`Found ${results.length} entries\n`);

      if (results.length === 0) break;

      for (const entry of results) {
        if (existingIds.has(entry.id) || errorIds.has(entry.id)) {
          console.log(`[SKIP] Already processed: ${entry.id}`);
          skipped++;
          continue;
        }

        const parsed = parseEntry(entry.enUS);
        if (!parsed) {
          console.log(`[ERROR] No pattern match: "${entry.enUS}"`);
          errors.push({ id: entry.id, enUS: entry.enUS, reason: "no_pattern_match" });
          errorIds.add(entry.id);
          failed++;
          continue;
        }

        const { npcName, prefixFr, suffixFr } = parsed;

        console.log(`[${entry.id}] Looking up "${npcName}"...`);
        const npcNameFr = await resolveNpcFr(npcName);

        if (!npcNameFr) {
          console.log(`  -> [ERROR] NPC not found on Wowhead`);
          errors.push({ id: entry.id, enUS: entry.enUS, npcName, reason: "npc_not_found" });
          errorIds.add(entry.id);
          failed++;
          continue;
        }

        const translation = `${prefixFr} ${npcNameFr}${suffixFr}`;
        console.log(`  -> ${translation}`);

        cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
        existingIds.add(entry.id);
        added++;
      }

      saveCache(cache);
      saveErrors(errors);
      saveNpcCache(npcCache);

      if (results.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
  }

  console.log(`\nDone! Added to cache: ${added}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total in cache: ${cache.length}, Total errors: ${errors.length}`);
}

async function safeMode() {
  const cache = loadCache();
  const errors = loadErrors();
  const existingIds = new Set(cache.map((e) => e.id));
  const errorIds = new Set(errors.map((e) => e.id));
  const submittedIds = await loadSubmittedIds();

  let submitted = 0;
  let cached = 0;
  let skipped = 0;
  let failed = 0;

  for (const table of GROUP.tables) {
    let offset = 0;
    console.log(`\n=== [SAFE] [${SEARCH_GROUP_NAME}] Table: ${table} ===`);

    while (true) {
      console.log(`Fetching '${GROUP.query}' entries (offset=${offset})...`);
      const { results } = await searchTranslations(GROUP.query, {
        limit: BATCH_SIZE, offset, table,
        include_untranslated: true,
        include_submission_status: true,
        treat_same_as_missing: TREAT_SAME_AS_MISSING,
      });
      console.log(`Found ${results.length} entries\n`);

      if (results.length === 0) break;

      for (const entry of results) {
        if (errorIds.has(entry.id)) {
          console.log(`[SKIP] Previously errored: ${entry.id}`);
          skipped++;
          continue;
        }

        // If already in cache but now can_submit, try to submit
        if (existingIds.has(entry.id)) {
          if (entry.can_submit && !submittedIds.has(entry.id)) {
            const cached = cache.find((e) => e.id === entry.id);
            if (cached?.frFR) {
              console.log(`[${entry.id}] Retrying submit from cache...`);
              try {
                const res = await submitTranslation(entry.id, cached.frFR);
                console.log(`  -> [SUBMIT] Done!`, JSON.stringify(res));
                cache.splice(cache.indexOf(cached), 1);
                submitted++;
              } catch (err) {
                console.log(`  -> [SUBMIT] Still failing: ${err.message}`);
              }
            }
          } else {
            console.log(`[SKIP] Already in cache: ${entry.id}`);
          }
          skipped++;
          continue;
        }

        const parsed = parseEntry(entry.enUS);
        if (!parsed) {
          console.log(`[ERROR] No pattern match: "${entry.enUS}"`);
          errors.push({ id: entry.id, enUS: entry.enUS, reason: "no_pattern_match" });
          errorIds.add(entry.id);
          failed++;
          continue;
        }

        const { npcName, prefixFr, suffixFr } = parsed;

        console.log(`[${entry.id}] Looking up "${npcName}"...`);
        const npcNameFr = await resolveNpcFr(npcName);

        if (!npcNameFr) {
          console.log(`  -> [ERROR] NPC not found on Wowhead`);
          errors.push({ id: entry.id, enUS: entry.enUS, npcName, reason: "npc_not_found" });
          errorIds.add(entry.id);
          failed++;
          continue;
        }

        const translation = `${prefixFr} ${npcNameFr}${suffixFr}`;
        console.log(`  -> ${translation}`);

        if (submittedIds.has(entry.id)) {
          console.log(`  -> [SKIP] Already submitted (pending review)`);
          skipped++;
          continue;
        } else if (entry.can_submit) {
          try {
            const res = await submitTranslation(entry.id, translation);
            console.log(`  -> [SUBMIT] Done!`, JSON.stringify(res));
            submittedIds.add(entry.id);
            submitted++;
          } catch (err) {
            console.log(`  -> [SUBMIT] Failed, caching: ${err.message}`);
            cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
            existingIds.add(entry.id);
            cached++;
          }
        } else {
          console.log(`  -> [CACHE] Already translated (${entry.submission_status})`);
          cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
          existingIds.add(entry.id);
          cached++;
        }
      }

      saveCache(cache);
      saveErrors(errors);
      saveNpcCache(npcCache);

      if (results.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
  }

  console.log(`\nDone! Submitted: ${submitted}, Cached: ${cached}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total in cache: ${cache.length}, Total errors: ${errors.length}`);
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
