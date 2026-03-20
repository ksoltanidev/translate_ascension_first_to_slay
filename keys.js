export const SEARCH_GROUPS = {
  "first-to-slay": {
    query: "First to slay",
    prefixes: [
      { en: "First to slay Rarespawn", fr: "Premier à tuer, créature rare" },
      { en: "First to slay Heroic", fr: "Premier à tuer Héroïque" },
      { en: "First to slay Mythic", fr: "Premier à tuer Mythique" },
      { en: "First to slay", fr: "Premier à tuer" },
    ],
    suffixes: [
      { en: "in Nightmare Mode.", fr: "en mode Cauchemar." },
    ],
    tables: ["achievement_criteria", "dbc_achievement", "dbc_achievement_criteria"],
  },
  "slay-heroic": {
    query: "Slay Heroic",
    prefixes: [
      { en: "Slay Heroic", fr: "Vaincre", frSuffix: "en Héroïque" },
    ],
    suffixes: [],
    tables: ["dbc_achievement"],
  },
  "slay-mythic": {
    query: "Slay Mythic",
    prefixes: [
      { en: "Slay Mythic", fr: "Vaincre", frSuffix: "en Mythique" },
    ],
    suffixes: [],
    tables: ["dbc_achievement"],
  },
};
