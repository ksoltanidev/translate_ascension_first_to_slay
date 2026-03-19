# firstToSlay

Translates "First to slay Rarespawn {NPC}" achievement criteria into French by looking up NPC names on Wowhead.

## Setup

```bash
cp .env.example .env
# Add your translation hub API key to .env
```

## Usage

```bash
node index.js
```

Adjust `BATCH_SIZE` at the top of `index.js` to control how many entries are processed per run.

## How it works

1. Fetches untranslated "First to slay" entries from the translation hub API
2. Parses each entry to extract the NPC name and detect prefix/suffix patterns
3. Looks up the NPC's French name on Wowhead (suggestions API + tooltip API with locale=2)
4. Submits the translated string back to the hub

## Files

- `index.js` — main script
- `keys.js` — translation patterns (prefixes & suffixes)
- `wowhead.js` — NPC name lookup via Wowhead APIs

## Translation patterns

| Pattern (EN) | Pattern (FR) |
|---|---|
| First to slay Rarespawn {NPC} | Premier à tuer, créature rare {NPC FR} |
| First to slay {NPC} | Premier à tuer {NPC FR} |
| ... in Nightmare Mode. | ... en mode Cauchemar. |
