/**
 * Looks up translated NPC names via Wowhead APIs.
 * Uses the suggestion API to find the NPC ID,
 * then the tooltip API with a locale param to get the translated name.
 */

const WOWHEAD_LOCALES = {
  en: 0,
  ko: 1,
  fr: 2,
  de: 3,
  zh: 4,
  es: 6,
  ru: 7,
  pt: 8,
};

export async function getNpcId(name) {
  const nameLower = name.toLowerCase();
  const nameNoApostrophe = name.replace(/'/g, "");

  // Try Classic first, fallback to main Wowhead (for TBC/Wrath bosses)
  // For each base, try original name first, then without apostrophe
  for (const base of [
    "https://www.wowhead.com/classic",
    "https://www.wowhead.com",
  ]) {
    for (const query of [name, nameNoApostrophe]) {
      const url = `${base}/search/suggestions-template?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      const match = data.results?.find((r) => r.typeName === "NPC" && r.name.toLowerCase() === nameLower);
      if (match) return { id: match.id, classic: base.includes("classic") };
    }
  }
  return null;
}

export async function getLocalizedName(npcId, locale = "fr", classic = true) {
  const localeId = WOWHEAD_LOCALES[locale];
  if (localeId === undefined) {
    throw new Error(`Unknown locale "${locale}". Available: ${Object.keys(WOWHEAD_LOCALES).join(", ")}`);
  }
  const base = classic ? "classic/" : "";
  const url = `https://nether.wowhead.com/${base}tooltip/npc/${npcId}?locale=${localeId}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.name;
}

export async function lookupNpc(englishName, locale = "fr") {
  const result = await getNpcId(englishName);
  if (!result) {
    return null;
  }
  return getLocalizedName(result.id, locale, result.classic);
}

// Backwards-compatible alias
export const lookupNpcFr = (englishName) => lookupNpc(englishName, "fr");
