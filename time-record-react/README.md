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
         └── StorageService ← localStorage backend today
               └── future: Supabase (re-implement the same methods)
```

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

---

## Verification

`verify.mjs` is a throwaway harness (not part of the app). It builds the
project, loads the real production bundle in jsdom, and drives the actual React
tree: **129 checks**, covering the storage contract, event schema, CRUD, the
full Insights drill-down, i18n persistence, reload persistence, corrupt-data
recovery, the PWA/Safari meta, and four Shortcut import payload shapes.

```bash
npm run build && node verify.mjs
```

### One known legacy bug, reproduced on purpose

`validDate()` destructures `{ y, m, dd }` from `parseISO()`, which returns
`{ y, m, d }`. `dd` is therefore always `undefined`, `validDate()` always
returns `false`, and **an imported event's `date` always falls back to today.**

This is present in the original `app.js` (verified by running it in the same
harness) and is faithfully reproduced here, because phase 1 must not change
behaviour. It is a one-line fix (`dd` → `d`) whenever you want it — say the
word and I will apply it to both the legacy app and the React version.

---

## Phase 2 (not started)

Apple UI polish, shadcn component adoption, and the Calflow-inspired Analytics
redesign. The donut spec image in the repo root already matches what the current
chart does (round caps, ~3px gap).
