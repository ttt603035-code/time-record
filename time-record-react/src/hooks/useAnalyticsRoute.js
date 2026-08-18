import { useCallback, useState } from 'react';

/**
 * The React replacement for the legacy module-level `analytics` object.
 *
 *   route:    { level: 'overview' | 'category' | 'task', category, task }
 *   selected: canonical category key highlighted on the Overview
 *   dir:      'push' | 'pop' | null — drives the slide animation classes
 *
 * Back behaviour is preserved exactly: Task → its previous Category if it was
 * reached from one, otherwise → Overview.
 */
export function useAnalyticsRoute() {
  const [route, setRoute] = useState({ level: 'overview', category: null, task: null });
  const [selected, setSelected] = useState(null);
  const [dir, setDir] = useState(null);

  const go = useCallback((level, payload) => {
    setRoute((prev) => {
      if (level === 'overview') {
        return {
          level: 'overview', category: null, task: null,
          prevLevel: prev.level, prevCategory: prev.category, prevTask: prev.task,
        };
      }
      if (level === 'category') {
        return {
          level: 'category', category: payload.categoryKey, task: null,
          prevLevel: prev.level, prevCategory: prev.category, prevTask: prev.task,
        };
      }
      return {
        level: 'task',
        category: payload.task ? payload.task.categoryKey : null,
        task: payload.task || null,
        prevLevel: prev.level, prevCategory: prev.category, prevTask: prev.task,
      };
    });
    if (level === 'overview') setSelected(null);
    setDir('push');
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    setRoute((r) => {
      if (r.level === 'task') {
        if (r.prevLevel === 'category' && r.prevCategory) {
          return { level: 'category', category: r.prevCategory, task: null };
        }
        return { level: 'overview', category: null, task: null };
      }
      if (r.level === 'category') {
        return { level: 'overview', category: null, task: null };
      }
      return r;
    });
    setDir('pop');
  }, []);

  const reset = useCallback(() => {
    setRoute({ level: 'overview', category: null, task: null });
    setSelected(null);
    setDir(null);
  }, []);

  return { route, selected, setSelected, dir, go, back, reset };
}
