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
- **Insights** — Day/Week/Month/Year time analytics with donut → Category → Task → Session drill-down, all derived automatically from your events
- **More → Data** — export JSON, import JSON, clear all data + live storage-key list
- **More → Event Templates** — add / edit / delete your categories (they feed the event form)
- **More → Language** — English / 中文 interface switch (persisted)

## Insights (时间分析)

Calflow-style time analytics, derived **live** from the Time Record — nothing is
stored separately, no second dataset. Every number on this screen is computed
from `state.events` at render time, so a new event (manual, or imported by the
Shortcut) is reflected everywhere immediately.

**Four shared ranges — Day / Week / Month / Year** (segments + ‹ › arrows +
tap-to-pick sheet). The range is global: the hero total, donut, trend, ranking
and task lists all switch together — no mixed periods.

Drill-down (Overview → Category → Task → Session):

| Level | What it answers |
| ----- | --------------- |
| **Overview** | Total time for the period; interactive donut of time distribution (center = total, tap a segment to cross-filter the trend + task list; tap the selected segment again to enter the Category); trend chart per range (tap a bucket to read its value); Top Tasks ranking |
| **Category** (`event.category`) | Category total, share of total, sessions, average session; its own trend; a task-level donut (tints of the category color) + task ranking |
| **Task** (`event.title` within a category) | Total time, sessions, average session, first/last recorded, sessions per week, share-of-total ring, its own trend, and the full session history |
| **Session** (one Time Record) | Tap any history row to expand Date / Start / End / Duration / Event / Category / note, plus an Edit shortcut into the event form |

- Navigation: dedicated back button, slide animations, iOS-style "tap the
  active Insights tab again to return to the overview".
- All charts are hand-drawn SVG (no libraries), tap-target-first for iPhone,
  and every segment/row is a real button (keyboard accessible).
- The Day overview keeps the time-block timeline (shared with the Today tab);
  tapping a block drills straight into that task's analytics.
- Categories are colored by their Event Template color; unknown categories fall
  back to their event color; uncategorized time is shown in neutral gray.
- Session definition: one event = one session; duration = end − start.

The hierarchy uses the existing record fields — `category` → `title` →
individual records — no invented grouping, no duplicated statistics.

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
