# Calendar

A mobile-first, Apple-style calendar web app. Built with plain HTML, CSS and
JavaScript — no frameworks, no build step. It loads fast on iPhone Safari and
persists everything on-device via `localStorage`.

**Design family:** Apple × StudyHub (visual language only — typography, color,
spacing, radius, surfaces, sheets). It is a brand-new app, not a StudyHub clone:
no sidebar, no dashboard, no StudyHub navigation.

---

## Files

| File         | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `index.html` | Markup — screens, tab bar, sheet/dialog/toast containers        |
| `styles.css` | All styling — design tokens, components, responsive rules       |
| `app.js`     | Logic — modular sections (see the banner comments inside)       |

## Code organisation (`app.js`)

1. Constants & config
2. `DateUtils` — ISO date helpers, Monday-first weeks
3. Event model — normalization, stable schema
4. `StorageService` — the **only** place that touches `localStorage`
5. `DataService` — facade the UI talks to (future Supabase swap point)
6. App state
7. DOM helpers + SVG icon set (no emoji)
8. Toast
9. Alert dialog
10. Bottom sheet (with drag-to-dismiss)
11. Wheel picker (iOS-style date/time columns)
12. Default times
13. Demo data (seeded **once**, never overwrites)
14. Calendar grid (+ swipe)
15. Day detail
16. Today screen
17. More screen (Data / About)
18. Month/year selector
19. Event form sheet (add/edit/delete)
20. Navigation & rendering
21. Wiring
22. Init

---

## Data architecture

```
UI (render functions)
   └── DataService            ← facade, the only data access point
         └── StorageService   ← localStorage backend today
               └── future: Supabase   (re-implement the same methods)
```

- Storage key: **`calendar_events_v1`** (stable) for events
- Storage key: **`calendar_categories_v1`** for event templates/categories
- Event value: `{ "version": 1, "events": [ … ] }`
- **The UI never calls `localStorage` directly.** All persistence goes through
  `StorageService` (`getEvents`, `saveEvents`, `addEvent`, `updateEvent`,
  `deleteEvent`, `importEvents`, `exportEvents`, `clearAll`, plus
  `getCategories` / `saveCategories`).
- `DataService.importAll(data)` already accepts an array **or** an
  `{events:[…]}` envelope — the entry point for a future Apple Shortcuts
  pipeline.

### Event templates (categories)

- Managed from **More → Event Templates** (a StudyHub-style popup).
- Each template is `{ id, name, color }` — freely add, rename, recolor, delete.
- They appear as quick-pick chips in the event form and drive the category
  suggestions; picking one also applies its color automatically.

### Event schema (stable, Shortcut-compatible)

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
  "createdAt": "2026-08-16T00:00:00.000Z",
  "updatedAt": "2026-08-16T00:00:00.000Z"
}
```

`color` ∈ `blue | purple | pink | green | orange`.

---

## Persistence rules (important)

- Data lives in `localStorage` under the app's **origin**. Keep the URL stable.
- The app **never** calls `localStorage.clear()` and never resets data on load.
- Demo data is created **only** when `calendar_events_v1` does not exist yet.
  Once real data exists, it is never overwritten.
- If stored JSON is corrupted, the raw payload is backed up under a separate
  key, the app continues with an empty list, and a notice is shown — the data is
  never silently destroyed.
- If `localStorage` is unavailable (e.g. a sandboxed preview), the app degrades
  to an in-memory store and shows a notice on the More screen.

---

## Deploying (stable URL is required for persistence)

Any static host works. Example — GitHub Pages:

1. Create a repository, push the three files (plus this README).
2. Repository → **Settings → Pages → Source: Deploy from a branch → main → / (root)**.
3. Your app is served at `https://<user>.github.io/<repo>/`.

Then **always open that same URL**. localStorage is scoped to the origin, so
every launch — page reload, Safari reopen, or a Shortcut that opens the URL —
shows the same data.

### Apple Shortcuts (future)

The plan:

1. Shortcut collects info → builds JSON → sends it to a backend/API
2. Backend stores the event (Supabase)
3. The app reads from Supabase via `DataService`

The current version is fully local and needs **no backend**. The architecture
(UI → `DataService` → provider) is already shaped so Supabase can replace
`StorageService` without rewriting the UI.

## Controls

- **‹ ›** — previous / next month (or swipe the calendar left/right)
- **Month/year title** — tap to open the Select Date sheet (year stepper + month grid)
- **Today** — jump back to today
- **+** — add an event (StudyHub-style popup with iOS-style date & time wheels)
- Tap an event — edit or delete (StudyHub-style popup + Apple confirmation dialog)
- **Calendar / Today / Insights / More** — floating capsule tabs
- **Insights** — 日/周/月/年 analytics, derived automatically from your events
- **More → Data** — export JSON, import JSON, clear all data + live storage-key list
- **More → Event Templates** — add / edit / delete your categories (they feed the event form)
- **More → Language** — English / 中文 interface switch (persisted)

## Insights (洞悉)

Four segments — **Day / Week / Month / Year** — each with a period picker
(‹ › arrows plus a tap-to-pick sheet that selects year, month, week or day):

| View  | Blocks                                                 |
| ----- | ------------------------------------------------------ |
| Day   | hourly time-block timeline + category donut            |
| Week  | category donut + per-weekday time distribution + 7-day event columns |
| Month | category donut + activity stats + daily trend line + hour distribution |
| Year  | category donut + monthly trend bars + hour distribution |

The donut chart shows the total in its center with the category legend
beneath it, and segments are separated by gaps so they never blend together.
All charts read the same `state.events`, so imported data is fully linked —
nothing needs to be imported per section. Charts are hand-drawn SVG (no
libraries) and scale to phone width. The Today tab shows the same time-block
timeline as Insights → Day, including a "now" line.

## Importing from Shortcuts

The Shortcut flow you'll use later (reading your phone's Calendar and
importing events):

1. In Shortcuts, use **Find Calendar Events** to gather events.
2. Build a JSON array with this schema (the app is lenient — only `date` and
   `title` are required, everything else is optional and defaults are filled in):

   ```json
   [
     {
       "date": "2026-08-16",
       "startTime": "09:00",
       "endTime": "10:30",
       "title": "CET-6 Reading",
       "category": "English",
       "color": "blue",
       "note": ""
     }
   ]
   ```

3. Save it as a file (e.g. `calendar.json`) and tap **More → Data → Import**.
4. The same guide is available in-app: **More → Import from Shortcuts**.

`color` ∈ `blue | purple | pink | green | orange`. Categories that don't exist
yet are shown as "Uncategorized" in Insights — add them under **Event Templates**
to give them a color.

Later, a Supabase backend will let the Shortcut send events automatically; the
data layer (UI → `DataService` → provider) is already architected for that.
