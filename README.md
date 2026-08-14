# CODEX 1.3

Amiga Workbench–inspired research desk. A four-color 1.3 station with an AmigaDOS CLI, a ranked TRACTATE-10, a Tree of Life, gematria, and a correspondence drawer.

## What it shows

**TRACTATE-10** is an editorial ranking of texts that taught the West to read the hidden — not a canon:

1. Poimandres · 2. Emerald Tablet · 3. Sefer Yetzirah · 4. Gospel of Thomas
5. Apocryphon of John · 6. Sefer ha-Bahir · 7. Zohar · 8. Fama Fraternitatis
9. Agrippa, Three Books · 10. Picatrix

Each card is a short cited summary. Excerpts are public-domain. Modern copyrighted translations are not hosted.

**TOL:Tree** is the classic 10 sefirot + 22 Golden Dawn letter/tarot paths, drawn as four-color SVG gadgets (no rainbow planetary paint).

**NUM:Gematria** sums Hebrew (standard + gadol + Atbash), Greek isopsephy, and English ordinal / reduction / reverse. Lexicon hits come from the local Hebrew word list.

**XREF** is a correspondence table (hermetic / kabbalah / alchemy / tarot / astrology) drawn from the existing esoterica-cli desk.

Personal pins live in `localStorage` (`codex.pins`).

This is a research desk, not a ritual engine.

## Run locally

```bash
python3 server.py
# open http://127.0.0.1:1987/
```

Port override: `CODEX_PORT=8080`. Bind: `CODEX_HOST=0.0.0.0` (defaults to loopback).

Stdlib only.

## Docker

```bash
docker compose up --build -d
# http://127.0.0.1:1987/
```

## CLI

```
1> help
1> list
1> show yetzirah
1> tree tiferet
1> path 27
1> gematria אהבה
1> xref mercury
1> find sophia
```

F1 help · F2 TRACT · F3 TREE · F4 GEM · F5 XREF.

## Notes

- Homage to Workbench 1.3 / Kickstart — not a Commodore product.
- Public-domain / public-record texts only. No full Nag Hammadi dump, no Liber AL.
- Next stations (BBSBENCH, AIRBENCH, …) stay in the Brain vault queue.
