let generator: () => string = () => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122-ish fallback — only used if no crypto source has been configured.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** The app wires `expo-crypto.randomUUID` here at startup. */
export function configureIdGenerator(fn: () => string): void {
  generator = fn;
}

export function newId(): string {
  return generator();
}

export function nowIso(): string {
  return new Date().toISOString();
}
