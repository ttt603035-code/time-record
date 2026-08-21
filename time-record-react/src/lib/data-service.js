/* ============================================================
   5. DATA SERVICE  (facade — future Supabase swap point)
   ------------------------------------------------------------
   Ported verbatim from legacy app.js. The UI depends only on
   DataService. Today every method forwards to StorageService.
   ============================================================ */

import { StorageService } from './storage.js';

export const DataService = {
  fetchAll: () => StorageService.getEvents(),
  create: (event) => StorageService.addEvent(event),
  update: (event) => StorageService.updateEvent(event),
  remove: (id) => StorageService.deleteEvent(id),
  removeMany: (ids) => StorageService.deleteEvents(ids),
  importAll: (data) => StorageService.importEvents(data),
  exportAll: () => StorageService.exportEvents(),
  clear: () => StorageService.clearAll(),
  fetchCategories: () => StorageService.getCategories(),
  saveCategories: (list) => StorageService.saveCategories(list),
  getSetting: (key) => StorageService.getSetting(key),
  setSetting: (key, value) => StorageService.setSetting(key, value),
};
