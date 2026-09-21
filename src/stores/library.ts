import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import type { SqlDatabase } from '@/db/adapter';
import { openDatabase } from '@/db/database';
import {
  createCollection as createCollectionRow,
  createSavedItem,
  type CreateSavedItemInput,
  deleteCollection as deleteCollectionRow,
  deleteSavedItem,
  getAllSettings,
  getSavedItem,
  listActiveRemindersWithItems,
  listCollectionsWithCounts,
  listOverdueItems,
  listSavedItems,
  listUpcomingItems,
  setItemCollection,
  setItemStatus,
  setSetting,
  updateCollection as updateCollectionRow,
} from '@/db/repositories';
import { processPendingPreviews } from '@/features/instagram/preview-queue';
import {
  cancelAllReminders,
  changeReminderNote,
  changeReminderRepeat,
  cancelOneReminder,
} from '@/features/reminders/scheduler';
import { rollRepeatingReminders } from '@/features/reminders/service';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '@/features/settings/settings';
import { deleteCachedThumbnail, pruneOrphanedThumbnails } from '@/services/storage/thumbnail-cache';
import type {
  CollectionColor,
  CollectionWithCount,
  ReminderRepeat,
  ReminderWithItem,
  SavedItem,
  SavedItemStatus,
} from '@/types/domain';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

export type CollectionDraft = { name: string; emoji?: string; color?: CollectionColor };

type LibraryState = {
  status: LibraryStatus;
  error: string | null;

  /** Every non-archived item, newest first. */
  items: SavedItem[];
  /** Items with a reminder still ahead, soonest first. */
  upcoming: SavedItem[];
  /** Items whose one-off reminder time has passed. */
  overdue: SavedItem[];
  /** Scheduled reminders with their items, soonest first. Drives the Reminders tab. */
  reminders: ReminderWithItem[];
  collections: CollectionWithCount[];
  settings: Settings;

  init: () => Promise<void>;
  refresh: () => Promise<void>;

  addItem: (input: CreateSavedItemInput) => Promise<SavedItem>;
  resolvePreviews: () => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItemStatus: (id: string, status: SavedItemStatus) => Promise<void>;
  moveItemToCollection: (id: string, collectionId: string | null) => Promise<void>;

  addCollection: (draft: CollectionDraft) => Promise<CollectionWithCount | null>;
  updateCollection: (id: string, draft: CollectionDraft) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;

  setReminderRepeat: (reminderId: string, repeat: ReminderRepeat) => Promise<void>;
  setReminderNote: (reminderId: string, note: string) => Promise<void>;
  removeReminder: (reminderId: string, savedItemId: string) => Promise<void>;
  clearItemReminders: (savedItemId: string) => Promise<void>;

  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  /** Light tap, when the Haptics preference is on. */
  tap: () => void;
};

/**
 * Database handle shared by the store and by services that need direct SQL access
 * (the preview queue and the reminder scheduler).
 */
let database: SqlDatabase | null = null;

export async function getDatabase(): Promise<SqlDatabase> {
  if (!database) {
    database = await openDatabase();
  }
  return database;
}

/** Test seam: lets a test supply its own database. */
export function setDatabase(db: SqlDatabase | null): void {
  database = db;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],
  upcoming: [],
  overdue: [],
  reminders: [],
  collections: [],
  settings: DEFAULT_SETTINGS,

  async init() {
    if (get().status === 'loading' || get().status === 'ready') {
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const db = await getDatabase();
      set({ settings: parseSettings(await getAllSettings(db)) });
      await get().refresh();
      set({ status: 'ready' });
    } catch (error) {
      set({ status: 'error', error: toMessage(error) });
    }
  },

  async refresh() {
    const db = await getDatabase();
    const now = new Date();

    // Repeating reminders roll forward before anything reads reminder times.
    await rollRepeatingReminders(db, now);

    const iso = now.toISOString();
    const [items, upcoming, overdue, reminders, collections] = await Promise.all([
      listSavedItems(db),
      listUpcomingItems(db, iso),
      listOverdueItems(db, iso),
      listActiveRemindersWithItems(db),
      listCollectionsWithCounts(db),
    ]);

    set({ items, upcoming, overdue, reminders, collections, error: null });
  },

  async addItem(input) {
    const db = await getDatabase();
    const item = await createSavedItem(db, input);
    await get().refresh();
    get().tap();

    // Deliberately not awaited: saving must never wait on preview resolution.
    void get().resolvePreviews();

    return item;
  },

  async resolvePreviews() {
    try {
      const db = await getDatabase();
      const result = await processPendingPreviews(db);
      if (result.processed > 0) {
        await get().refresh();
      }
    } catch {
      // A failed preview run is never surfaced as a library error: the items are fine.
    }
  },

  async removeItem(id) {
    const db = await getDatabase();

    // Cancel OS notifications and remove the cached image before the row goes.
    await cancelAllReminders(db, id);
    const item = await getSavedItem(db, id);
    deleteCachedThumbnail(item?.cachedThumbnailPath);

    await deleteSavedItem(db, id);
    await get().refresh();
    pruneOrphanedThumbnails(get().items.map((entry) => entry.id));
  },

  async updateItemStatus(id, status) {
    const db = await getDatabase();
    await setItemStatus(db, id, status);
    await get().refresh();
  },

  async moveItemToCollection(id, collectionId) {
    const db = await getDatabase();
    await setItemCollection(db, id, collectionId);
    await get().refresh();
    get().tap();
  },

  async addCollection(draft) {
    const name = draft.name.trim();
    if (name.length === 0) {
      return null;
    }
    const db = await getDatabase();
    const collection = await createCollectionRow(db, { ...draft, name });
    await get().refresh();
    get().tap();
    return { ...collection, itemCount: 0 };
  },

  async updateCollection(id, draft) {
    const name = draft.name.trim();
    if (name.length === 0) {
      return;
    }
    const db = await getDatabase();
    await updateCollectionRow(db, id, { ...draft, name });
    await get().refresh();
  },

  async removeCollection(id) {
    const db = await getDatabase();
    await deleteCollectionRow(db, id);
    await get().refresh();
  },

  async setReminderRepeat(reminderId, repeat) {
    const db = await getDatabase();
    await changeReminderRepeat(db, reminderId, repeat, { sound: get().settings.notificationSound });
    await get().refresh();
    get().tap();
  },

  async setReminderNote(reminderId, note) {
    const db = await getDatabase();
    await changeReminderNote(db, reminderId, note);
    await get().refresh();
  },

  async removeReminder(reminderId, savedItemId) {
    const db = await getDatabase();
    await cancelOneReminder(db, reminderId, savedItemId);
    await get().refresh();
    get().tap();
  },

  async clearItemReminders(savedItemId) {
    const db = await getDatabase();
    await cancelAllReminders(db, savedItemId);
    await get().refresh();
  },

  async updateSetting(key, value) {
    const db = await getDatabase();
    await setSetting(db, key, String(value));
    set({ settings: { ...get().settings, [key]: value } });
  },

  tap() {
    if (get().settings.haptics) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
  },
}));

/** Reads one item from the store cache without another query. */
export function selectItemById(id: string) {
  return (state: LibraryState): SavedItem | undefined => state.items.find((item) => item.id === id);
}
