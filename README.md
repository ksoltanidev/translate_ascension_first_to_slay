# firstToSlay

Translates achievement criteria containing NPC names into French by looking up NPC names on Wowhead and submitting translations to the Ascension Translation Hub.

## Setup

```bash
cp .env.example .env
# Add your translation hub API key and configure settings
```

`.env` options:
- `TRANSLATION_API_KEY` — your translation hub API key (required)
- `BATCH_SIZE` — entries per API page (default: 10)
- `DELAY_BETWEEN_REQUESTS` — delay in ms between Wowhead calls (default: 500, only applied on cache miss)
- `TREAT_SAME_AS_MISSING` — treat entries where enUS == frFR as missing (default: false)
- `SEARCH_GROUP` — which pattern group to process (default: `first-to-slay`)

## Usage

### Translation script

```bash
npm start              # safe mode (default)
npm start safe         # check can_submit, submit or cache accordingly
npm start cache        # translate all, store in cache without submitting
npm start submit       # submit all cached translations
```

**safe** — fetches entries across all tables with pagination, translates them, then:
- Already submitted (pending review) → skip
- `can_submit: true` → submit directly to the hub
- `can_submit: false` → store in `translation-cache.json` for later
- Submit fails → cache for later

**cache** — translates everything into `translation-cache.json` without submitting

**submit** — submits all entries from `translation-cache.json`

### Search groups

Switch between pattern groups via `SEARCH_GROUP` in `.env`:

| Group | Query | Tables |
|---|---|---|
| `first-to-slay` (default) | First to slay | achievement_criteria, dbc_achievement, dbc_achievement_criteria |
| `slay-heroic` | Slay Heroic | dbc_achievement |
| `slay-mythic` | Slay Mythic | dbc_achievement |

### NPC lookup

```bash
node npc.js "Lord Darkscythe"       # → Seigneur Sombrefaux
node npc.js "Lord Darkscythe" de    # → Lord Finstersense
```

Standalone NPC name lookup. Checks `npc-cache.json` first, falls back to Wowhead.

## How it works

1. Loads pending submissions to avoid re-submitting (safe mode)
2. Iterates over each table in the active search group, paginating with offset
3. Parses each entry to extract the NPC name and detect prefix/suffix patterns
4. Looks up the NPC's translated name on Wowhead (cache first, then suggestions API + tooltip API)
5. Submits or caches the translation depending on `can_submit`
6. Saves all caches after each batch (crash-safe)

## Files

### Scripts
- `index.js` — main translation script (safe/cache/submit modes)
- `npc.js` — standalone NPC name lookup CLI
- `keys.js` — search groups, translation patterns (prefixes, suffixes, tables)
- `wowhead.js` — NPC name lookup via Wowhead APIs
- `npc-cache.js` — NPC name cache read/write helpers

### Caches (committed)
- `npc-cache.json` — cached NPC name translations (EN → FR/DE/etc.), avoids repeated Wowhead calls
- `translation-cache.json` — translated entries pending submission (waiting for API to allow overwrite)
- `errors-cache.json` — entries that failed processing (NPC not found, no pattern match). Skipped on re-run, delete to retry.

## Translation patterns

| Pattern (EN) | Pattern (FR) |
|---|---|
| First to slay Rarespawn {NPC} | Premier à tuer, créature rare {NPC FR} |
| First to slay Heroic {NPC} | Premier à tuer Héroïque {NPC FR} |
| First to slay Mythic {NPC} | Premier à tuer Mythique {NPC FR} |
| First to slay {NPC} | Premier à tuer {NPC FR} |
| Slay Heroic {NPC} | Tuez Héroïque {NPC FR} |
| Slay Mythic {NPC} | Tuez Mythique {NPC FR} |
| ... in Nightmare Mode. | ... en mode Cauchemar. |
