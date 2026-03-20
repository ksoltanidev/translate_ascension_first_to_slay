# firstToSlay

Translates "First to slay Rarespawn {NPC}" achievement criteria into French by looking up NPC names on Wowhead.

## Setup

```bash
cp .env.example .env
# Add your translation hub API key and configure settings
```

`.env` options:
- `TRANSLATION_API_KEY` — your translation hub API key (required)
- `BATCH_SIZE` — number of entries per run (default: 10)
- `DELAY_BETWEEN_REQUESTS` — delay in ms between Wowhead calls (default: 500)

## Usage

### Translation script

```bash
npm start              # safe mode (default)
npm start safe         # check can_submit, submit or cache accordingly
npm start cache        # translate all, store in cache without submitting
npm start submit       # submit all cached translations
```

**safe** — fetches entries, translates them, then:
- `can_submit: true` → submits directly to the hub
- `can_submit: false` → stores in `translation-cache.json` for later

**cache** — translates everything into `translation-cache.json` without submitting

**submit** — submits all entries from `translation-cache.json`

### NPC lookup

```bash
node npc.js "Lord Darkscythe"       # → Seigneur Sombrefaux
node npc.js "Lord Darkscythe" de    # → Lord Finstersense
```

Standalone NPC name lookup. Checks `npc-cache.json` first, falls back to Wowhead.

## How it works

1. Fetches "First to slay" entries from the translation hub API (with `include_untranslated` + `include_submission_status`)
2. Parses each entry to extract the NPC name and detect prefix/suffix patterns
3. Looks up the NPC's translated name on Wowhead (suggestions API + tooltip API)
4. Submits or caches the translation depending on `can_submit`

## Files

- `index.js` — main translation script (safe/cache/submit modes)
- `npc.js` — standalone NPC name lookup CLI
- `keys.js` — translation patterns (prefixes & suffixes)
- `wowhead.js` — NPC name lookup via Wowhead APIs
- `npc-cache.js` — NPC name cache read/write helpers
- `npc-cache.json` — cached NPC names (auto-generated)
- `translation-cache.json` — cached translations pending submission (auto-generated)

## Translation patterns

| Pattern (EN) | Pattern (FR) |
|---|---|
| First to slay Rarespawn {NPC} | Premier à tuer, créature rare {NPC FR} |
| First to slay {NPC} | Premier à tuer {NPC FR} |
| ... in Nightmare Mode. | ... en mode Cauchemar. |
