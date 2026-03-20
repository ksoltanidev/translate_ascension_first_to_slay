import { SEARCH_GROUPS } from "../keys.js";

export function parseEntry(groupName, text) {
  const group = SEARCH_GROUPS[groupName];
  if (!group) return null;

  const parseFn = PARSERS[group.parser || "prefix-npc-suffix"];
  if (!parseFn) return null;

  return parseFn(group, text);
}

const PARSERS = {
  "prefix-npc-suffix": parsePrefixNpcSuffix,
  "defeat-realm-first": parseDefeatRealmFirst,
};

function parsePrefixNpcSuffix(group, text) {
  for (const prefix of group.prefixes) {
    if (!text.startsWith(prefix.en + " ")) continue;

    let rest = text.slice(prefix.en.length + 1);
    let suffixFr = "";

    for (const suffix of group.suffixes) {
      if (rest.endsWith(suffix.en)) {
        rest = rest.slice(0, -suffix.en.length).trimEnd();
        suffixFr = ` ${suffix.fr}`;
        break;
      }
    }

    return {
      type: "prefix-npc-suffix",
      npcName: rest,
      prefixFr: prefix.fr,
      prefixFrSuffix: prefix.frSuffix || "",
      suffixFr,
    };
  }
  return null;
}

function parseDefeatRealmFirst(group, text) {
  const base = "Defeat Realm First! ";
  if (!text.startsWith(base)) return null;

  let rest = text.slice(base.length);

  // Extract mode: "Heroic: ", "Mythic: ", "Ascended: "
  let mode = null;
  for (const m of group.modes) {
    if (rest.startsWith(m.en + ": ")) {
      mode = m;
      rest = rest.slice(m.en.length + 2);
      break;
    }
  }

  // Extract location from end: " in {Location}."
  const inIdx = rest.lastIndexOf(" in ");
  if (inIdx === -1) return null;
  const location = rest.slice(inIdx + 4).replace(/\.$/, "");
  rest = rest.slice(0, inIdx);

  // Extract optional size: " (10 Player)" or " (25 Player)"
  let size = null;
  const sizeMatch = rest.match(/ \((\d+ Player)\)$/);
  if (sizeMatch) {
    size = sizeMatch[1];
    rest = rest.slice(0, -sizeMatch[0].length);
  }

  return { type: "defeat-realm-first", npcName: rest, mode, size, location };
}
