export const API_KEY = process.env.TRANSLATION_API_KEY;
export const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
export const DELAY = parseInt(process.env.DELAY_BETWEEN_REQUESTS || "500", 10);
export const TREAT_SAME_AS_MISSING = process.env.TREAT_SAME_AS_MISSING === "true";
export const AMEND = process.env.AMEND === "true";
export const SEARCH_GROUP_NAME = process.env.SEARCH_GROUP || "first-to-slay";
export const BASE_URL = "https://translation-hub.darkuniverse.work/api/v1";
export const LOCALE = "frFR";
export const MODE = process.argv[2] || "safe";

export const CACHE_FILE = "data/translation-cache-realm.json";
export const ERRORS_FILE = "data/errors-cache.json";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
