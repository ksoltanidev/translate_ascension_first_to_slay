import { AMEND, BATCH_SIZE } from "../config.js";
import { submitTranslation, amendTranslation, loadSubmittedIds, getContext } from "../api.js";
import { loadCache, saveCache } from "../cache.js";

export async function submitMode() {
  const cache = loadCache();
  if (cache.length === 0) {
    console.log("Cache is empty. Run with 'cache' mode first.");
    return;
  }

  const submittedIds = await loadSubmittedIds();

  console.log(`Processing ${cache.length} cached translations...\n`);

  let submitted = 0;
  let amended = 0;
  let skipped = 0;
  let failed = 0;
  let kept = 0;

  for (let i = 0; i < cache.length; i++) {
    const entry = cache[i];

    // 1. Already submitted → skip, mark for removal
    if (submittedIds.has(entry.id)) {
      console.log(`[SKIP] Already submitted: ${entry.id}`);
      cache.splice(i, 1);
      i--;
      skipped++;
      continue;
    }

    // 2. Get context from API
    let context;
    try {
      context = await getContext(entry.id);
    } catch (err) {
      console.log(`[${entry.id}] Failed to get context: ${err.message}`);
      failed++;
      continue;
    }

    const existing = context.output;

    // 3. No existing translation → submit
    if (!existing) {
      console.log(`[${entry.id}] No existing translation → submitting`);
      console.log(`  ${entry.frFR}`);
      try {
        const res = await submitTranslation(entry.id, entry.frFR);
        console.log(`  -> [SUBMIT] Done!`, JSON.stringify(res));
        cache.splice(i, 1);
        i--;
        submitted++;
      } catch (err) {
        console.log(`  -> [SUBMIT] Failed: ${err.message}`);
        failed++;
      }
    }
    // 4. Existing translation matches ours → skip, remove from cache
    else if (existing === entry.frFR) {
      console.log(`[${entry.id}] Translation already matches → removing from cache`);
      cache.splice(i, 1);
      i--;
      skipped++;
    }
    // 5. Existing translation differs → amend if enabled, else keep in cache
    else {
      console.log(`[${entry.id}] Different translation exists`);
      console.log(`  existing: ${existing}`);
      console.log(`  ours:     ${entry.frFR}`);
      if (AMEND) {
        try {
          const res = await amendTranslation(entry.id, entry.frFR);
          console.log(`  -> [AMEND] Done!`, JSON.stringify(res));
          cache.splice(i, 1);
          i--;
          amended++;
        } catch (err) {
          console.log(`  -> [AMEND] Failed: ${err.message}`);
          failed++;
        }
      } else {
        console.log(`  -> [KEEP] Amend disabled, keeping in cache`);
        kept++;
      }
    }

    // Save cache after each batch
    if ((i + 1) % BATCH_SIZE === 0) {
      saveCache(cache);
      console.log(`  [SAVE] Cache saved (${cache.length} remaining)\n`);
    }
  }

  saveCache(cache);
  console.log(`\nDone! Submitted: ${submitted}, Amended: ${amended}, Skipped: ${skipped}, Kept: ${kept}, Failed: ${failed}`);
  if (cache.length > 0) {
    console.log(`${cache.length} entries still in cache`);
  }
}
