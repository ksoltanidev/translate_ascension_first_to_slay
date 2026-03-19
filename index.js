import { lookupNpcFr } from "./wowhead.js";
import { PREFIXES, SUFFIXES } from "./keys.js";

const API_KEY = process.env.TRANSLATION_API_KEY;
if (!API_KEY) {
  console.error("Missing TRANSLATION_API_KEY in .env");
  process.exit(1);
}

const BATCH_SIZE = 5;
const BASE_URL = "http://translation-hub.darkuniverse.work/api/v1";
const LOCALE = "frFR";

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
      submission_comment: "Submitted with 'trollzcrank firstToSlay' script" },
  });
}

async function main() {
  console.log("Fetching 'First to slay' entries...");
  const { results } = await searchTranslations("First to slay", BATCH_SIZE);
  console.log(`Found ${results.length} entries\n`);

  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of results) {
    const parsed = parseEntry(entry.enUS);
    if (!parsed) {
      console.log(`[SKIP] No pattern match: "${entry.enUS}"`);
      skipped++;
      continue;
    }

    const { npcName, prefixFr, suffixFr } = parsed;

    // Look up French NPC name on Wowhead
    console.log(`[${entry.id}] Looking up "${npcName}"...`);
    const npcNameFr = await lookupNpcFr(npcName);

    if (!npcNameFr) {
      console.log(`  -> NPC not found on Wowhead, skipping`);
      failed++;
      continue;
    }

    const translation = `${prefixFr} ${npcNameFr}${suffixFr}`;
    console.log(`  -> ${translation}`);

    // Submit translation
    try {
      await submitTranslation(entry.id, translation);
      console.log(`  -> Submitted!`);
      translated++;
    } catch (err) {
      console.log(`  -> Submit failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Translated: ${translated}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
