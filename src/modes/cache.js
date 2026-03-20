import { BATCH_SIZE, TREAT_SAME_AS_MISSING, SEARCH_GROUP_NAME } from "../config.js";
import { SEARCH_GROUPS } from "../../keys.js";
import { searchTranslations } from "../api.js";
import { loadCache, saveCache, loadErrors, saveErrors } from "../cache.js";
import { resolveNpcFr, saveNpcCacheToDisk } from "../npc.js";
import { parseEntry } from "../parser.js";
import { buildTranslation } from "../translator.js";

const GROUP = SEARCH_GROUPS[SEARCH_GROUP_NAME];

export async function cacheMode() {
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

        const translation = buildTranslation(parsed, npcNameFr);
        if (!translation) {
          console.log(`  -> [ERROR] Could not build translation`);
          errors.push({ id: entry.id, enUS: entry.enUS, reason: "build_failed" });
          errorIds.add(entry.id);
          failed++;
          continue;
        }

        console.log(`  -> ${translation}`);

        cache.push({ id: entry.id, enUS: entry.enUS, frFR: translation });
        existingIds.add(entry.id);
        added++;
      }

      saveCache(cache);
      saveErrors(errors);
      saveNpcCacheToDisk();

      if (results.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
  }

  console.log(`\nDone! Added to cache: ${added}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total in cache: ${cache.length}, Total errors: ${errors.length}`);
}
