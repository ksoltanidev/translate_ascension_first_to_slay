import { SEARCH_GROUPS } from "./keys.js";
import { API_KEY, SEARCH_GROUP_NAME, MODE } from "./src/config.js";
import { safeMode } from "./src/modes/safe.js";
import { cacheMode } from "./src/modes/cache.js";
import { submitMode } from "./src/modes/submit.js";

if (!API_KEY) {
  console.error("Missing TRANSLATION_API_KEY in .env");
  process.exit(1);
}

if (!SEARCH_GROUPS[SEARCH_GROUP_NAME]) {
  console.error(`Unknown SEARCH_GROUP: "${SEARCH_GROUP_NAME}". Available: ${Object.keys(SEARCH_GROUPS).join(", ")}`);
  process.exit(1);
}

const MODES = { safe: safeMode, cache: cacheMode, submit: submitMode };
const run = MODES[MODE];

if (!run) {
  console.error(`Unknown mode: "${MODE}". Use "safe", "cache" or "submit".`);
  process.exit(1);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
