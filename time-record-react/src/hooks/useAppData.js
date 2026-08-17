import { useCallback, useEffect, useRef, useState } from 'react';

import { DataService } from '@/lib/data-service.js';
import { StorageService } from '@/lib/storage.js';
import { DEFAULT_CATEGORIES, normalizeCategory } from '@/lib/model.js';
import { buildDemoEvents } from '@/lib/demo-data.js';
import { importFromShortcutURL } from '@/lib/shortcut-import.js';
import { getLang, setLang, t } from '@/lib/i18n.js';
import { toast } from '@/lib/overlays.js';

/**
 * The React replacement for the legacy global `state` object + `refreshAll()`.
 *
 * Responsibilities (all carried over from legacy `init()`):
 *   1. load the persisted language before the first render
 *   2. load events + categories through DataService
 *   3. seed DEFAULT_CATEGORIES only when none exist yet
 *   4. consume a Shortcut `?import=` URL BEFORE the demo seed
 *   5. seed demo events only on a genuinely fresh install
 *   6. surface the storage-unavailable / corrupt-data notices
 *
 * Data always flows UI → DataService → StorageService. This hook never
 * touches localStorage directly.
 */
export function useAppData() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lang, setLangState] = useState(getLang());
  const [ready, setReady] = useState(false);
  const initStarted = useRef(false);

  const refreshEvents = useCallback(async () => {
    const list = await DataService.fetchAll();
    setEvents(list);
    return list;
  }, []);

  const refreshCategories = useCallback(async () => {
    const list = await DataService.fetchCategories();
    setCategories(list);
    return list;
  }, []);

  /* ── Boot sequence — mirrors legacy init() exactly ── */
  useEffect(() => {
    // StrictMode double-invokes effects in dev; the legacy app booted once.
    if (initStarted.current) return;
    initStarted.current = true;

    (async () => {
      const savedLang = await DataService.getSetting('lang');
      if (savedLang === 'zh' || savedLang === 'en') {
        setLang(savedLang);
        setLangState(savedLang);
      }
      document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';

      await refreshEvents();
      let cats = await refreshCategories();

      if (StorageService.categoriesFresh) {
        await DataService.saveCategories(DEFAULT_CATEGORIES.map(normalizeCategory));
        cats = await refreshCategories();
      }

      // A Shortcut URL is consumed before demo seeding. On a first launch, a
      // valid import therefore becomes the user's initial dataset instead of
      // being mixed with sample records.
      const imported = await importFromShortcutURL(cats);
      if (imported) {
        await refreshEvents();
        await refreshCategories();
        toast(imported.ok
          ? t('imported', { n: imported.added + imported.updated })
          : t('importFailed'));
      }

      // One-time demo seed: ONLY when no stored/imported data exists.
      // Never overwrites.
      if (StorageService.wasFresh) {
        await DataService.importAll(buildDemoEvents());
        await refreshEvents();
      }

      setReady(true);

      if (!StorageService.available) {
        toast('Preview: local storage is unavailable here');
      } else if (StorageService.corrupt) {
        toast('Some stored data was damaged — a backup was preserved');
      }
    })();
  }, [refreshEvents, refreshCategories]);

  /* ── Mutations (each one refreshes from the source of truth) ── */

  const createEvent = useCallback(async (event) => {
    await DataService.create(event);
    return refreshEvents();
  }, [refreshEvents]);

  const updateEvent = useCallback(async (event) => {
    await DataService.update(event);
    return refreshEvents();
  }, [refreshEvents]);

  const removeEvent = useCallback(async (id) => {
    await DataService.remove(id);
    return refreshEvents();
  }, [refreshEvents]);

  const saveCategories = useCallback(async (list) => {
    await DataService.saveCategories(list);
    return refreshCategories();
  }, [refreshCategories]);

  const clearAll = useCallback(async () => {
    await DataService.clear();
    return refreshEvents();
  }, [refreshEvents]);

  const applyLanguage = useCallback(async (next) => {
    setLang(next);
    setLangState(next);
    await DataService.setSetting('lang', next);
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    toast(next === 'zh' ? '已切换为中文' : 'Switched to English');
  }, []);

  return {
    events,
    categories,
    lang,
    ready,
    refreshEvents,
    refreshCategories,
    createEvent,
    updateEvent,
    removeEvent,
    saveCategories,
    clearAll,
    applyLanguage,
  };
}
