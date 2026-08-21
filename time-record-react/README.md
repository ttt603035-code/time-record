# Time Record — React + Vite + shadcn/ui

Phase-1 **architecture migration** of the stable HTML/CSS/JS app that lives in
the repository root. Same features, same data, same look — different plumbing.

> **Nothing was removed and nothing was redesigned.** The legacy
> `index.html` / `styles.css` / `app.js` in the parent directory are untouched
> and still the deployed version.

---

## Running it

```bash
cd time-record-react
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve the production build
```

Testing on a real iPhone/iPad on the same Wi-Fi: `npm run dev` binds to
`0.0.0.0`, so open `http://<your-mac-ip>:5173/`.

---

## What carried over, unchanged

### Storage keys and schema — the data contract

| Key | Value |
| --- | --- |
| `calendar_events_v1` | `{ "version": 1, "events": [ … ] }` |
| `calendar_categories_v1` | `[{ id, name, color }]` |
| `calendar_settings_v1` | `{ "lang": "en" \| "zh" }` |
| `calendar_events_v1_backup_<ts>` | automatic backup of a corrupted payload |

```json
{
  "id": "evt_…",
  "date": "2026-08-16",
  "startTime": "09:00",
  "endTime": "10:30",
  "title": "CET-6 Reading",
  "category": "English",
  "color": "blue",
  "note": "",
  "createdAt": "…",
  "updatedAt": "…"
}
```

Field names are identical to the legacy app — `startTime` / `endTime` /
`title` / `note`, not Start/End/Event/Notes. There is **no stored `duration`**:
it is always computed as `end − start`, and every Analytics number is derived
from `events` at render time. No second dataset.

Because the keys and the origin are unchanged, **an existing install keeps all
its data** when it eventually opens the React build from the same URL.

### Data flow

```
UI (pages / components)
   └── DataService          ← facade, the only data access point
         └── StorageService ← localStorage backend (the source of truth)

Cloud Sync (optional, opt-in)
   SyncSettingsModal → supabase-sync.js → Supabase
                            └── sync-core.js  ← merge rules, no transport
```

`sync-core.js` is deliberately transport-free so the merge semantics can be
tested without a network; `supabase-sync.js` holds the client and loads the
SDK through a dynamic import, keeping it out of the initial bundle. The same
logic exists in legacy `app.js` as `SyncService`, and `verify-sync.mjs` checks
the two agree row-for-row.

`StorageService` and `DataService` were copied over verbatim, including the
localStorage probe, the in-memory fallback for sandboxed previews, and the
corrupt-payload backup.

### Apple Shortcuts — no changes needed

```text
https://ttt603035-code.github.io/time-record/?import=<URL-encoded JSON>
```

Still accepts a single object, an array, `{ events: [...] }` and
`{ data: [...] }`; still consumes the parameter exactly once via
`history.replaceState` so a reload cannot duplicate an ID-less record; still
runs before the demo seed. A stable `id` updates instead of duplicating.

`vite.config.js` sets `base: './'`, so the build works from any sub-path and
the Shortcut URL never has to change.

### PWA / Safari

`manifest.webmanifest` (`start_url` and `scope` still `./`), the four icons,
`apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, the status-bar
style, `theme-color`, `viewport-fit=cover` and `user-scalable=no` all carried
over. There is no service worker — there never was one.

---

## Project structure

```
time-record-react/
├── index.html                  PWA meta, #overlays + #toast + #importFile hosts
├── vite.config.js              base './', dev server on 0.0.0.0
├── tailwind.config.js          preflight DISABLED (see below)
├── components.json             shadcn/ui config
├── public/                     manifest.webmanifest, icons/
└── src/
    ├── main.jsx                index.css (shadcn) → styles.css (legacy)
    ├── App.jsx                 tab state, screen switching, shared handlers
    ├── styles.css              byte-for-byte copy of the legacy stylesheet
    ├── index.css               Tailwind layers + --sh-* tokens
    ├── lib/
    │   ├── constants.js        storage keys, colors, ITEM_H
    │   ├── date.js             ISO helpers, Monday-first weeks
    │   ├── i18n.js             EN/中文 table + t()
    │   ├── model.js            normalizeEvent / normalizeImport / categories
    │   ├── storage.js          StorageService (only place touching localStorage)
    │   ├── data-service.js     DataService facade
    │   ├── demo-data.js        one-time seed
    │   ├── shortcut-import.js  ?import= pipeline
    │   ├── analytics.js        all aggregation (pure functions)
    │   ├── overlays.js         toast, dialog, sheet, modal, wheel picker
    │   ├── dom.js              el(), SVG icon set, hexToRgba
    │   └── utils.js            shadcn cn()
    ├── hooks/
    │   ├── useAppData.js       events + categories + lang + boot sequence
    │   ├── useInsightsRange.js Day/Week/Month/Year range
    │   └── useAnalyticsRoute.js Overview → Category → Task routing
    ├── components/
    │   ├── ui/                 shadcn/ui (button)
    │   ├── BottomTabBar.jsx    incl. the Liquid Glass indicator
    │   ├── CalendarGrid.jsx    42-cell grid + swipe + month animation
    │   ├── DayTimeline.jsx     time blocks (Today + Insights → Day)
    │   ├── EventCard.jsx  EmptyState.jsx
    │   ├── EventFormModal.js  TemplatesModal.js
    │   ├── MonthSelectorSheet.js  InsightsPickerSheet.js  ImportGuideModal.js
    │   ├── charts/             DonutChart, TrendChart, ShareRing
    │   └── insights/           ChartCard, RankList, TaskList, SessionHistory,
    │                           StatTile, RangeSegments, PeriodSelector
    └── pages/
        ├── Calendar.jsx  Today.jsx  More.jsx
        └── insights/     Insights.jsx, Overview.jsx, CategoryView.jsx,
                          TaskView.jsx, TrendCard.jsx
```

### Two deliberate decisions

**1. Tailwind preflight is off.** `styles.css` is the stable visual language and
carries its own reset; letting preflight run would change the baseline. shadcn
components still work — they only need utility classes. The shadcn tokens are
namespaced `--sh-*` so they can never collide with `--bg` / `--text` / `--accent`.

**2. Gesture-heavy widgets stayed imperative**, mounted through a `ref` inside a
React component: the wheel picker's scroll snapping, the sheet's pointer
drag-to-dismiss, the calendar swipe, and the SVG charts' event delegation.
Re-expressing those declaratively risks subtle drift in exactly the places where
iPhone/iPad feel matters most. They are still cleanly separated modules.

### shadcn/ui status

Fully configured — `components.json`, Tailwind, CSS variables, the `@/` alias,
`cn()` in `lib/utils.js`, and `components/ui/button.jsx` as a working component.
Add more with `npx shadcn@latest add <component>`.

Per the phase-1 brief, **no existing UI was rewritten to use shadcn.** That is
phase 2.

### shadcn Skills (AI assistant context)

`npx skills add shadcn/ui` is installed, so an AI assistant working in this repo
gets project-aware shadcn context — it reads `components.json` for the
framework, aliases, base library, icon library and installed components, and
follows the correct composition patterns instead of guessing.

```
.agents/skills/shadcn/                 the skill (canonical copy)
.agents/skills/migrate-radix-to-base/  bundled alongside it
.claude/skills/*                       symlinks into .agents/
skills-lock.json                       pinned source + content hashes
```

Documentation only — no runtime dependency, nothing imported by the app, and
Tailwind only scans `src/`, so the bundle is unchanged. Update with
`npx skills add shadcn/ui --yes`.

Two notes on this install:

- The installer also wrote an `agent/` directory duplicating `.agents/`
  byte-for-byte (only the SKILL.md frontmatter format differs). It was removed
  to avoid two divergent copies; `.agents/` is what the symlinks resolve to.
- `shadcn info --json` needs network access to `ui.shadcn.com`, which this
  sandbox blocks. It will work normally on your machine.

---

## Verification

`verify.mjs` is a throwaway harness (not part of the app). It builds the
project, loads the real production bundle in jsdom, and drives the actual React
tree: **132 checks**, covering the storage contract, event schema, CRUD, the
full Insights drill-down, i18n persistence, reload persistence, corrupt-data
recovery, the PWA/Safari meta, and four Shortcut import payload shapes.

```bash
npm run build && node verify.mjs
```

### Fixed: imported dates were silently replaced by today

`validDate()` destructured `{ y, m, dd }` from `parseISO()`, which returns
`{ y, m, d }`. `dd` was therefore always `undefined`, `validDate()` always
returned `false`, and **every imported event's `date` fell back to today** —
so a Shortcut sending yesterday's session filed it under today, and importing
a backup collapsed the whole history onto a single day.

Fixed in **both** the React version (`src/lib/date.js`) and the legacy
`app.js`, so the two stay in sync:

```js
const { y, m, d: day } = parseISO(d);
```

Genuinely invalid dates (e.g. `2026-02-31`) still fall back to today, which is
the defensive behaviour the bug was masking. Covered by regression checks for
single-object, array and envelope payloads.

### Fixed: donut segments now follow the spec sheet

The Donut Chart spec sheet asks for six things: round corner joins, a corner
radius of **0.25–0.4x the ring thickness**, 2–4px gaps, uniform thickness,
clean separation, and an iOS-native feel. It explicitly rejects 尖角连接
(sharp joins), **过度圆滑粘连** (over-rounded segments merging) and 间距过大.

Two problems, both fixed:

**1. Small slices merged into their neighbours.** A round line cap extends half
a stroke width past each end, so a slice inks `dash + stroke width` and needs at
least `stroke width + gap` — 27.5px of a 455.7px ring, i.e. **6%** — to render.
Anything smaller kept the full 24.5px stroke but clamped its dash to 0.1px, so
two caps painted a ~24.6px blob across a ~9px arc, **overlapping the neighbour
by 15.4px** — exactly the 过度圆滑粘连 failure mode.

**2. The corner radius was out of range.** `stroke-linecap="round"` always
produces a half-thickness semicircular dome (**0.5x**), overshooting the
specified 0.25–0.4x. The spec's detail diagram shows a *flat radial end with
small rounded corners*, which a line cap cannot express at all.

Segments are now **annular-sector paths** (`src/lib/donut-geometry.js`) with the
corner radius decoupled from the ring thickness — set to 0.32x, mid-range. Each
visible slice is guaranteed enough arc for its corners plus the gap, taken
proportionally from slices that can spare it, so thickness stays uniform rather
than thinning small slices. Hit areas use the same allocation, so taps still
land on the segment under the finger.

Fixed in both `src/components/charts/DonutChart.jsx` and the legacy `app.js`.

```bash
npm run build && node donut-spec.mjs   # 11/11
```

`donut-spec.mjs` rasterises the real component with resvg and measures actual
pixels — ring thickness, every gap, and the corner inset — rather than trusting
the markup. Verified across single-segment, dominant-plus-sliver, five-slivers,
all-equal and ten-segment datasets: gaps stay within 2.92–3.12px and the ring
holds a uniform 24.40px throughout.

### New: delete sample data without hunting events

A freshly synced device seeds demo data (or carries over history), and getting
rid of it meant deleting events one by one.

**More → Manage by category** (`src/pages/More.jsx`). A card on the More
screen lists every event grouped by its category (template order, unknown
categories alphabetical, uncategorized last), each row with a delete button,
and each group with a *delete all* action — so a whole category of sample
data goes in one tap. Both ask for a confirmation dialog like every other
destructive action in the app.

Deletion semantics note: the React build deletes directly (no Trash), while
the legacy build moves deletions into its 2-day Trash and erases the cloud
copy at sync. The manage card uses the same `DataService.remove` / new
`DataService.removeMany` the rest of the React app uses, so it behaves like
the existing delete everywhere.

---

## Phase 2 (not started)

Apple UI polish, shadcn component adoption, and the Calflow-inspired Analytics
redesign. The donut spec image in the repo root already matches what the current
chart does (round caps, ~3px gap).
