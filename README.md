# Calendar

A mobile-first, Apple-style calendar web app. Built with plain HTML, CSS and
JavaScript — no frameworks, no build step. It loads fast on iPhone Safari and
persists everything on-device via `localStorage`.

**Design family:** Apple × StudyHub (visual language only — typography, color,
spacing, radius, surfaces, sheets). It is a brand-new app, not a StudyHub clone:
no sidebar, no dashboard, no StudyHub navigation.

---

## Files

| File / directory       | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `index.html`           | Markup — screens, tab bar, sheet/dialog/toast containers       |
| `styles.css`           | All styling — design tokens, components, responsive rules      |
| `app.js`               | Logic — modular sections (see the banner comments inside)      |
| `manifest.webmanifest` | Installable-web-app metadata and icon declarations             |
| `icons/`               | App icons cropped and resized from `IMG_7816.jpeg`              |
| `tools/make_icons.py`  | Reproducible center-crop/resize tool (never redraws the source) |

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

1. Merge the finished pull request into `main`.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Source: Deploy from a branch**,
   then **Branch: main**, folder **/ (root)**, and click **Save**.
4. Wait for the Pages deployment to finish. This repository is served at
   `https://ttt603035-code.github.io/time-record/`.

Then **always open that same URL**. `localStorage` is scoped to the origin, so
every launch — page reload, Safari reopen, or a Shortcut that opens the URL —
shows the same data. On iPhone, use Safari's **Share → Add to Home Screen** to
install it with the icon generated from `IMG_7816.jpeg`.

### Local-first, with optional cloud sync

The app is fully local and needs **no backend**. Apple Shortcuts can import an
event immediately by opening the URL described below.

**Cloud Sync** (More → Cloud Sync) is opt-in: point it at a Supabase project you
own and your events are mirrored there, so a second device can pick them up. It
is off until you configure it, and turning it off changes nothing locally. See
[Cloud Sync](#cloud-sync-可选云同步) for the setup.

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
- **More → Cloud Sync** — optional Supabase mirror (set up, test, sync now, disconnect)

## Cloud Sync (可选云同步)

Off by default. Everything keeps working locally whether you turn it on or not.

### 1. Create the table

In your Supabase project, open **SQL Editor** and run the script shown under
**More → Cloud Sync → Set up → Create the table** (there is a Copy button).
It creates `public.events`, an index on `user_key`, and an RLS policy.

### 2. Connect the app

**More → Cloud Sync → Set up**, then fill in three fields:

| Field | Where to find it |
|---|---|
| **Project URL** | Supabase → Settings → Data API → Project URL |
| **Anon key** | Supabase → Settings → API Keys → `anon` `public` |
| **Passphrase** | You invent it. Use the **same** one on every device. |

**Save** tests the connection first and refuses to store a configuration that
does not work — sync that looks enabled but is silently broken is worse than
sync that is plainly off.

### 3. Sync

Tap **Sync now** on each device. Sync is manual on purpose: nothing leaves the
device until you ask it to.

### How conflicts are resolved

Last-write-wins on each event's `updatedAt`:

- an event only one side has → copied to the other
- the same event edited on both → the more recent edit wins
- identical timestamps → the local copy is kept and nothing is written

**Deletions are not synced.** Without tombstones, "this row is missing" and
"this row was deleted" look identical, and guessing wrong destroys data
silently. So deleting an event on one device does not delete it elsewhere, and
the next sync will copy it back from whichever device still has it. Clearing
data stays a local, explicit action.

### Security — read this before using it

This setup has **no login**, so the anon key is the only credential, and an anon
key shipped to a browser is public by definition. The policy in the setup script
therefore lets **anyone holding that key read and write the table**. The
passphrase namespaces your rows; it is *not* a security boundary, because
someone with the key can query without it.

That is a reasonable trade for a private hobby calendar in an obscure project.
It is **not** appropriate for anything sensitive or shared. To get a real
boundary, enable Supabase Auth and switch to the `auth.uid()` policy included as
a comment at the end of the setup SQL.

Credentials are stored under their own `calendar_sync_v1` key: **Clear all** does
not sign you out, and an exported JSON file never contains your key.

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

### One-tap URL import

1. In Shortcuts, build one event as JSON. Only `date` and `title` are required;
   omitted fields receive safe defaults:

   ```json
   {
     "date": "2026-08-16",
     "startTime": "09:00",
     "endTime": "10:30",
     "title": "CET-6 Reading",
     "category": "English",
     "color": "blue",
     "note": ""
   }
   ```

2. URL-encode the JSON text, append it to the stable Pages URL as the `import`
   query value, and use Shortcuts' **Open URLs** action:

   ```text
   https://ttt603035-code.github.io/time-record/?import=<URL-encoded JSON>
   ```

3. The app imports the record into `localStorage`, updates every view, shows a
   result toast, and removes `import` from the address so a refresh cannot add
   the same no-ID record again. A single object, an array, and
   `{ "events": [...] }` / `{ "data": [...] }` envelopes are all accepted.

For larger batches, save the same JSON as a file and use
**More → Data → Import**. If records include stable `id` values, importing that
ID again updates it instead of creating a duplicate.

`color` ∈ `blue | purple | pink | green | orange`. Categories that do not have
an Event Template still appear in Insights using the event's color; add them
under **Event Templates** to manage their shared color.

## Rebuilding the app icons

Run the committed tool whenever the source image changes:

```bash
python3 tools/make_icons.py IMG_7816.jpeg
```

The tool only applies EXIF orientation, a centered square crop, and high-quality
resizing. It does not redraw, filter, decorate, or round the source artwork.
It uses Pillow when installed and otherwise falls back to ImageMagick.
