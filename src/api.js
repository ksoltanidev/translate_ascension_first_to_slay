import { API_KEY, BASE_URL, LOCALE, sleep } from "./config.js";

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const MAX_CALLS_PER_SECOND = 10;
const callTimestamps = [];

export async function api(path, options = {}) {
  const { method = "GET", body } = options;

  // Rate limiting: max 10 requests per second (sliding window)
  const now = Date.now();
  while (callTimestamps.length > 0 && callTimestamps[0] <= now - 1000) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= MAX_CALLS_PER_SECOND) {
    const wait = callTimestamps[0] + 1000 - now;
    await sleep(wait);
  }
  callTimestamps.push(Date.now());

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
      if (err.message?.startsWith("API ")) throw err;
      console.log(`  [API] ${err.message} — retrying in ${RETRY_DELAY * attempt / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY * attempt);
    }
  }
}

export async function loadSubmittedIds() {
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

export async function searchTranslations(query, {
  limit = 100,
  offset = 0,
  table,
  include_untranslated = false,
  include_submission_status = false,
  treat_same_as_missing = false,
} = {}) {
  const params = new URLSearchParams({
    q: query, locale: LOCALE, limit, offset,
    include_untranslated, include_submission_status, treat_same_as_missing,
  });
  if (table) params.set("table", table);
  return api(`/translations/search?${params}`);
}

export async function submitTranslation(translationId, value) {
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

export async function getContext(translationId) {
  return api(`/translations/${translationId}/context?locale=${LOCALE}`);
}

export async function amendTranslation(translationId, value) {
  return api("/account/submissions/amend", {
    method: "PATCH",
    body: {
      translation_id: translationId,
      locale: LOCALE,
      value,
      submission_comment: "Amended with 'trollzcrank firstToSlay' script",
    },
  });
}
