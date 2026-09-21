import { useEffect, useState } from 'react';

import type { SavedItemFilter } from '@/db/repositories';
import { searchSavedItems } from '@/db/repositories';
import { getDatabase } from '@/stores/library';
import type { SavedItem } from '@/types/domain';

/** Typing delay before a query hits the database (PROJECT_PLAN.md §23). */
const DEBOUNCE_MS = 250;

type Completed = {
  query: string;
  filter: SavedItemFilter;
  revision: number;
  items: SavedItem[];
};

export type SearchState = {
  /** True when a query or a non-default filter is in effect. */
  active: boolean;
  results: SavedItem[];
  /** True while the current query has not produced results yet. */
  searching: boolean;
};

/**
 * Debounced search over the local database.
 *
 * `revision` lets the caller force a re-run after the library changes, so results do not go
 * stale after a save or a delete.
 *
 * State is only ever written from the async callback. The "searching" flag is derived by
 * comparing the current inputs with the ones that produced the last result, which avoids a
 * synchronous state update inside the effect.
 */
export function useSavedItemSearch(
  query: string,
  filter: SavedItemFilter,
  revision: number
): SearchState {
  const [completed, setCompleted] = useState<Completed | null>(null);

  const active = query.trim().length > 0 || filter !== 'all';

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const db = await getDatabase();
          const items = await searchSavedItems(db, query, filter, new Date().toISOString());
          if (!cancelled) {
            setCompleted({ query, filter, revision, items });
          }
        } catch {
          if (!cancelled) {
            setCompleted({ query, filter, revision, items: [] });
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, filter, revision, active]);

  const isCurrent =
    completed !== null &&
    completed.query === query &&
    completed.filter === filter &&
    completed.revision === revision;

  return {
    active,
    results: isCurrent ? completed.items : [],
    searching: active && !isCurrent,
  };
}
