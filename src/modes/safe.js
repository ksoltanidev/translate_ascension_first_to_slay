import { BATCH_SIZE, TREAT_SAME_AS_MISSING, AMEND, SEARCH_GROUP_NAME } from "../config.js";
import { SEARCH_GROUPS } from "../../keys.js";
import { searchTranslations, submitTranslation, amendTranslation, loadSubmittedIds } from "../api.js";
import { loadCache, saveCache, loadErrors, saveErrors } from "../cache.js";
import { resolveNpcFr, saveNpcCacheToDisk } from "../npc.js";
import { parseEntry } from "../parser.js";
import { buildTranslation } from "../translator.js";

const GROUP = SEARCH_GROUPS[SEARCH_GROUP_NAME];

export async function safeMode() {
  const cache = loadCache();
  const errors = loadErrors();
  const errorIds = new Set(errors.map((e) => e.id));
  const submittedIds = await loadSubmittedIds();

  let submitted = 0;
  let amended = 0;
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
        // 1. Already submitted → skip
        if (submittedIds.has(entry.id)) {
          console.log(`[SKIP] Already submitted: ${entry.id}`);
          skipped++;
          continue;
        }

        // 2. Previously errored → skip
        if (errorIds.has(entry.id)) {
          console.log(`[SKIP] Previously errored: ${entry.id}`);
          skipped++;
          continue;
        }

        // 3. Resolve translation: from cache or build new
        const cachedEntry = cache.find((e) => e.id === entry.id);
        let translation;

        if (cachedEntry?.frFR) {
          translation = cachedEntry.frFR;
          console.log(`[${entry.id}] From cache: ${translation}`);
        } else {
          const parsed = parseEntry(SEARCH_GROUP_NAME, entry.enUS);
          if (!parsed) {
            console.log(`[ERROR] No pattern match: "${entry.enUS}"`);
            errors.push({ id: entry.id, enUS: entry.enUS, reason: "no_pattern_match" });
            errorIds.add(entry.id);
            failed++;
            continue;
          }

          console.log(`[${entry.id}] Looking up "${parsed.npcName}"...`);
          const npcNameFr = await resolveNpcFr(parsed.npcName);

          if (!npcNameFr) {
            console.log(`  -> [ERROR] NPC not found on Wowhead`);
            errors.push({ id: entry.id, enUS: entry.enUS, npcName: parsed.npcName, reason: "npc_not_found" });
            errorIds.add(entry.id);
            failed++;
            continue;
          }

          translation = buildTranslation(parsed, npcNameFr);
          if (!translation) {
            console.log(`  -> [ERROR] Could not build translation`);
            errors.push({ id: entry.id, enUS: entry.enUS, reason: "build_failed" });
            errorIds.add(entry.id);
            failed++;
            continue;
          }

          console.log(`  -> ${translation}`);

          // Store in cache for future runs
          if (!cachedEntry) {
            cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
          }
        }

        // 4. Submit or amend
        if (entry.can_submit) {
          try {
            const res = await submitTranslation(entry.id, translation);
            console.log(`  -> [SUBMIT] Done!`, JSON.stringify(res));
            submittedIds.add(entry.id);
            const idx = cache.findIndex((e) => e.id === entry.id);
            if (idx !== -1) cache.splice(idx, 1);
            submitted++;
          } catch (err) {
            console.log(`  -> [SUBMIT] Failed: ${err.message}`);
            failed++;
          }
        } else if (entry.frFR && entry.frFR !== translation) {
          if (AMEND) {
            try {
              const res = await amendTranslation(entry.id, translation);
              console.log(`  -> [AMEND] Done!`, JSON.stringify(res));
              // TODO: If amends appears in submission list, we remove the key from the cache.
              amended++;
            } catch (err) {
              console.log(`  -> [AMEND] Failed, caching: ${err.message}`);
              if (!cachedEntry) {
                cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
              }
              failed++;
            }
          } else {
            console.log(`  -> [CACHE] Different translation, amend disabled`);
            if (!cachedEntry) {
              cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
            }
            cached++;
          }
        } else {
          console.log(`  -> [SKIP] Translation matches or missing`);
          skipped++;
        }
      }

      saveCache(cache);
      saveErrors(errors);
      saveNpcCacheToDisk();

      if (results.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
  }

  console.log(`\nDone! Submitted: ${submitted}, Amended: ${amended}, Cached: ${cached}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total in cache: ${cache.length}, Total errors: ${errors.length}`);
}
