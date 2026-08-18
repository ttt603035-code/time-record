/* ============================================================
   Themes
   ------------------------------------------------------------
   A theme only re-tints the accent — the colour used for the
   selected day, primary buttons, focus rings and links. Surfaces,
   text and the event/category palette stay exactly as they are,
   so switching theme cannot hurt legibility or make saved data
   look different.

   Applied by setting `data-theme` on <html>; the matching CSS
   lives in styles.css. The default ('graphite') sets no attribute
   so the original stylesheet values apply untouched.
   ============================================================ */

export const DEFAULT_THEME = 'graphite';

/**
 * `accent` is the tint. `swatch` is what the settings row shows, which for
 * the default is the same near-black the app has always used.
 */
export const THEMES = [
  { id: 'graphite', labelKey: 'themeGraphite', accent: '#1D1D1F', swatch: '#1D1D1F' },
  { id: 'blue', labelKey: 'themeBlue', accent: '#5B8DBE', swatch: '#5B8DBE' },
  { id: 'sage', labelKey: 'themeSage', accent: '#6FA88C', swatch: '#6FA88C' },
  { id: 'clay', labelKey: 'themeClay', accent: '#C08A6E', swatch: '#C08A6E' },
  { id: 'lavender', labelKey: 'themeLavender', accent: '#9186C4', swatch: '#9186C4' },
  { id: 'rose', labelKey: 'themeRose', accent: '#C4808F', swatch: '#C4808F' },
];

export const THEME_IDS = THEMES.map((t) => t.id);

/** Write the theme to <html>, or clear it for the default. */
export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) ? id : DEFAULT_THEME;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  return theme;
}
