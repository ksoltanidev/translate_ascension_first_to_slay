const SIZE_MAP = {
  "10 Player": "10 joueurs",
  "25 Player": "25 joueurs",
};

const LOCATION_MAP = {
  "Karazhan": "Karazhan",
  "Zul'Aman": "Zul'Aman",
  "Serpentshine Caverns": "Caverne du sanctuaire du Serpent",
  "Mount Hyjal": "Mont Hyjal",
  "Tempest Keep": "Donjon de la Tempête",
  "Black Temple": "Temple noir",
  "Sunwell Plateau": "Plateau du Puits de soleil",
  "Gruul's Lair": "Repaire de Gruul",
  "Magtheridon's Lair": "Repaire de Magtheridon",
};

export function buildTranslation(parsed, npcNameFr) {
  if (parsed.type === "prefix-npc-suffix") {
    const { prefixFr, prefixFrSuffix, suffixFr } = parsed;
    return `${prefixFr} ${npcNameFr}${prefixFrSuffix ? ` ${prefixFrSuffix}` : ""}${suffixFr}`;
  }

  if (parsed.type === "defeat-realm-first") {
    const { mode, size, location } = parsed;
    const locationFr = LOCATION_MAP[location];
    if (!locationFr) return null;

    let result = "Vaincre Premier du royaume !";
    if (mode) result += ` ${mode.fr} :`;
    result += ` ${npcNameFr}`;
    if (size) {
      const sizeFr = SIZE_MAP[size];
      if (!sizeFr) return null;
      result += ` (${sizeFr})`;
    }
    result += ` dans ${locationFr}.`;
    return result;
  }

  return null;
}
