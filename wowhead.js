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
  const url = `https://www.wowhead.com/classic/search/suggestions-template?q=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const data = await res.json();

  const match = data.results?.find((r) => r.typeName === "NPC" && r.name === name);
  if (!match) {
    return null;
  }
  return match.id;
}

export async function getLocalizedName(npcId, locale = "fr") {
  const localeId = WOWHEAD_LOCALES[locale];
  if (localeId === undefined) {
    throw new Error(`Unknown locale "${locale}". Available: ${Object.keys(WOWHEAD_LOCALES).join(", ")}`);
  }
  const url = `https://nether.wowhead.com/classic/tooltip/npc/${npcId}?locale=${localeId}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.name;
}

export async function lookupNpc(englishName, locale = "fr") {
  const id = await getNpcId(englishName);
  if (!id) {
    return null;
  }
  return getLocalizedName(id, locale);
}

// Backwards-compatible alias
export const lookupNpcFr = (englishName) => lookupNpc(englishName, "fr");
