import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore';
import { db as fireDb, isFirebaseConfigured } from '../firebase';
import idb from '../db';

type Listener = () => void;
type Row = { id: string; [key: string]: unknown };

const EMPTY: Row[] = [];

class PersistentStore {
  private cache = new Map<string, Row[]>();
  private listeners = new Map<string, Set<Listener>>();
  private nextIds = new Map<string, number>();
  private ready = false;
  private readyListeners = new Set<Listener>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.hydrate();
    try {
      this.channel = new BroadcastChannel('tournament-store');
      this.channel.onmessage = (event) => {
        const { type, path, id, updates, item } = event.data;
        if (type === 'update') {
          const current = this.cache.get(path) ?? [];
          this.cache.set(
            path,
            current.map((row) => {
              if (row.id !== id) return row;
              const merged = { ...row, ...updates };
              for (const key of Object.keys(updates)) {
                if (updates[key] === undefined) delete merged[key];
              }
              return merged;
            }),
          );
          this.notify(path);
        } else if (type === 'add') {
          const current = this.cache.get(path) ?? [];
          if (!current.some((r) => r.id === item.id)) {
            this.cache.set(path, [...current, item]);
            const idNum = parseInt(item.id.replace('local_', ''), 10);
            if (!isNaN(idNum)) {
              const prev = this.nextIds.get(path) ?? 0;
              if (idNum > prev) this.nextIds.set(path, idNum);
            }
            this.notify(path);
          }
        } else if (type === 'remove') {
          const current = this.cache.get(path) ?? [];
          this.cache.set(path, current.filter((r) => r.id !== id));
          this.notify(path);
        } else if (type === 'removeCollection') {
          this.cache.set(path, []);
          this.notify(path);
        }
      };
    } catch {
      // BroadcastChannel not available
    }
  }

  private async hydrate(): Promise<void> {
    try {
      const allDocs = await idb.documents.toArray();
      for (const d of allDocs) {
        const path = d._collection;
        const { _rowId, _collection, ...data } = d;
        const current = this.cache.get(path) ?? [];
        this.cache.set(path, [...current, data as Row]);

        const idNum = parseInt(data.id.replace('local_', ''), 10);
        if (!isNaN(idNum)) {
          const prev = this.nextIds.get(path) ?? 0;
          if (idNum >= prev) this.nextIds.set(path, idNum);
        }
      }
    } catch {
      // IndexedDB unavailable (e.g. private browsing) -- fall back to memory only
    }
    this.ready = true;
    this.readyListeners.forEach((l) => l());
    for (const path of this.cache.keys()) {
      this.notify(path);
    }
  }

  subscribe = (path: string, listener: Listener): (() => void) => {
    if (!this.listeners.has(path)) this.listeners.set(path, new Set());
    this.listeners.get(path)!.add(listener);
    return () => this.listeners.get(path)?.delete(listener);
  };

  getSnapshot = (path: string): Row[] => {
    return this.cache.get(path) ?? EMPTY;
  };

  isReady(): boolean {
    return this.ready;
  }

  onReady(listener: Listener): () => void {
    if (this.ready) { listener(); return () => {}; }
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  add(path: string, item: Record<string, unknown>): string {
    const counter = (this.nextIds.get(path) ?? 0) + 1;
    this.nextIds.set(path, counter);
    const id = `local_${counter}`;
    const row = { ...item, id };
    const current = this.cache.get(path) ?? [];
    this.cache.set(path, [...current, row]);
    this.notify(path);

    this.channel?.postMessage({ type: 'add', path, item: row });

    idb.documents.add({ _collection: path, ...row } as never).catch(() => {});
    return id;
  }

  update(path: string, id: string, updates: Record<string, unknown>): void {
    const undefinedKeys = Object.keys(updates).filter((k) => updates[k] === undefined);

    const current = this.cache.get(path) ?? [];
    this.cache.set(
      path,
      current.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };
        for (const k of undefinedKeys) delete merged[k];
        return merged;
      }),
    );
    this.notify(path);

    this.channel?.postMessage({ type: 'update', path, id, updates });

    idb.documents
      .where({ _collection: path, id })
      .modify((record: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(updates)) {
          if (v === undefined) {
            delete record[k];
          } else {
            record[k] = v;
          }
        }
      })
      .catch(() => {});
  }

  remove(path: string, id: string): void {
    const current = this.cache.get(path) ?? [];
    this.cache.set(path, current.filter((item) => item.id !== id));
    this.notify(path);

    this.channel?.postMessage({ type: 'remove', path, id });

    idb.documents
      .where({ _collection: path, id })
      .delete()
      .catch(() => {});
  }

  removeCollection(path: string): void {
    this.cache.set(path, []);
    this.notify(path);

    this.channel?.postMessage({ type: 'removeCollection', path });

    idb.documents
      .where('_collection')
      .equals(path)
      .delete()
      .catch(() => {});
  }

  private notify(path: string): void {
    this.listeners.get(path)?.forEach((l) => l());
  }
}

export const localStore = new PersistentStore();

function useLocalCollection<T extends { id: string }>(path: string) {
  const subscribeFn = useCallback(
    (cb: () => void) => localStore.subscribe(path, cb),
    [path],
  );
  const snapshotFn = useCallback(
    () => localStore.getSnapshot(path),
    [path],
  );

  const data = useSyncExternalStore(subscribeFn, snapshotFn) as T[];

  const add = useCallback(
    async (item: Omit<T, 'id'>) => localStore.add(path, item as Record<string, unknown>),
    [path],
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>) => localStore.update(path, id, updates as Record<string, unknown>),
    [path],
  );

  const remove = useCallback(
    async (id: string) => localStore.remove(path, id),
    [path],
  );

  return { data, loading: false, error: null, add, update, remove };
}

export function useCollection<T extends { id: string }>(
  path: string,
  constraints: QueryConstraint[] = [],
) {
  const localFallback = useLocalCollection<T>(path);
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !path) {
      setData([]);
      setLoading(false);
      return;
    }

    setData([]);
    setLoading(true);
    setError(null);

    const colRef = collection(fireDb, path);
    const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Firestore error at ${path}:`, err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [path]);

  if (!isFirebaseConfigured) {
    return localFallback;
  }

  const add = async (item: Omit<T, 'id'>) => {
    const colRef = collection(fireDb, path);
    const docRef = await addDoc(colRef, item as DocumentData);
    return docRef.id;
  };

  const update = async (id: string, updates: Partial<T>) => {
    const docRef = doc(fireDb, path, id);
    await updateDoc(docRef, updates as DocumentData);
  };

  const remove = async (id: string) => {
    const docRef = doc(fireDb, path, id);
    await deleteDoc(docRef);
  };

  return { data, loading, error, add, update, remove };
}

export function useTournaments() {
  return useCollection<import('../types').Tournament & { id: string }>(
    'tournaments',
    isFirebaseConfigured ? [orderBy('createdAt', 'desc')] : [],
  );
}
