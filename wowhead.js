/**
 * Looks up the French name of a WoW NPC given its English name.
 * Uses Wowhead's suggestion API to find the NPC ID,
 * then the tooltip API with locale=2 (French) to get the translated name.
 */

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

export async function getFrenchName(npcId) {
  const url = `https://nether.wowhead.com/classic/tooltip/npc/${npcId}?locale=2`;
  const res = await fetch(url);
  const data = await res.json();
  return data.name;
}

export async function lookupNpcFr(englishName) {
  const id = await getNpcId(englishName);
  if (!id) {
    return null;
  }
  return getFrenchName(id);
}
