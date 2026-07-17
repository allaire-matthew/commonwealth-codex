# The Commonwealth Codex

A public policy resource for Massachusetts — a district-by-district index of
where every school district stands on the technology shaping children's school
days: phone policies, 1:1 device programs, classroom AI, and student data
privacy. Self-updating from public sources. Live at
<https://allaire-matthew.github.io/commonwealth-codex/>.

Forked from the earlier `ma-power-map` tool (that URL remains frozen as last
deployed).

Three views:

- **Map** — pannable/zoomable SVG map of all 351 towns with two lenses
  (Phone policy / Organizing) plus boundary overlays (counties, school
  districts, US House, MA Senate, MA House).
- **Local groups** — the spreadsheet view: every town with an identified
  parent-organizing group, with affiliation logos and leads.
- **EdTech** — per-district listing of what runs in the classroom: 1:1
  device programs, platforms, AI tools/policies, notable services,
  contracts, and signed student-data-privacy agreements (SDPC/MSPA
  registry). A listing, not a rating. Data in
  `public/data/edtech-services.json`, merged from research runs via
  `scripts/merge_edtech.py`.

The **Guide** button explains the tier system and local-groups data — the
humane layer for anyone new to the tool. Design rules and their sources live
in `DESIGN.md`.

## Data & self-updating

`public/data/*.json` is refreshed daily by `.github/workflows/refresh.yml`
(7:17 UTC): legislators, town orgs, school-committee meetings, and
handbook-extracted phone policies. Pushing to `main` triggers `deploy.yml` →
GitHub Pages.

Heuristics (unchanged, single source `src/colors.ts` + `src/model.ts`):

- **Phone-policy tiers 1–4** — Childhood Index / DFSPP spec (see
  `phone-policies.json` `_notes`).

## Local development

```bash
npm install
npm run dev
```

Open the printed URL (path: `/ma-power-map/`). `npm run build:geo`
regenerates the GeoJSON from Census TIGER (see `scripts/build-geo.sh`).
