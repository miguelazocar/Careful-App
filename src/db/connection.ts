import type { Db } from './types';

let instance: Db | null = null;
const listeners = new Set<() => void>();

/** Registers the active database (expo-sqlite in the app, node:sqlite in tests). */
export function setDb(db: Db | null): void {
  instance = db;
}

export function getDb(): Db {
  if (!instance) throw new Error('Database not initialised. Call initDatabase() first.');
  return instance;
}

/** Repositories call this after every write so the UI (and backups) can react. */
export function notifyDataChanged(): void {
  listeners.forEach((l) => l());
}

export function onDataChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
