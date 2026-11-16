/**
 * Accessory tags the user can customize: the suggested ones (ACCESSORY_TAGS) minus those removed,
 * plus the user's own. Pure — the settings store keeps the AccessoryTagPrefs.
 *
 * A record stores the tag key in `record_items.item`; removing a tag only hides it from the
 * pickers, so older accessories keep showing it in their history and in the PDF.
 */
import { ACCESSORY_CATEGORY, ACCESSORY_ICONS, ACCESSORY_TAGS } from './maintenance';

export interface CustomAccessoryTag {
  /** `accesorios.u-<id>`: persisted in records, never reused. */
  key: string;
  label: string;
  /** Removed by the user: hidden from the pickers, still names older records. */
  removed?: boolean;
}

export interface AccessoryTagPrefs {
  /** Suggested tags the user removed (keys). */
  hidden: string[];
  custom: CustomAccessoryTag[];
}

export const DEFAULT_ACCESSORY_TAG_PREFS: AccessoryTagPrefs = { hidden: [], custom: [] };

export interface AccessoryTagDef {
  key: string;
  label: string;
  icon: string;
  /** Created by the user (vs. suggested by Careful). */
  custom: boolean;
}

const MAX_LABEL = 30;
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const suggested = (key: string, label: string): AccessoryTagDef => ({ key, label, icon: ACCESSORY_ICONS[key] ?? 'tag', custom: false });
const mine = (t: CustomAccessoryTag): AccessoryTagDef => ({ key: t.key, label: t.label, icon: 'tag', custom: true });

/** Tags offered when logging an accessory: suggested ones not removed, then the user's own. */
export function activeAccessoryTags(prefs: AccessoryTagPrefs = DEFAULT_ACCESSORY_TAG_PREFS): AccessoryTagDef[] {
  return [
    ...ACCESSORY_TAGS.filter((t) => !prefs.hidden.includes(t.key)).map((t) => suggested(t.key, t.label)),
    ...prefs.custom.filter((t) => !t.removed).map(mine),
  ];
}

/** Any tag, removed or not, so older records keep their label. Undefined = no tag. */
export function resolveAccessoryTag(item: string | null | undefined, prefs: AccessoryTagPrefs = DEFAULT_ACCESSORY_TAG_PREFS): AccessoryTagDef | undefined {
  if (!item) return undefined;
  const builtIn = ACCESSORY_TAGS.find((t) => t.key === item);
  if (builtIn) return suggested(builtIn.key, builtIn.label);
  const custom = prefs.custom.find((t) => t.key === item);
  return custom ? mine(custom) : undefined;
}

export type AddTagResult = { ok: true; prefs: AccessoryTagPrefs; key: string; restored: boolean } | { ok: false; error: string };

/**
 * Adds a tag by name. A name matching a removed tag brings that one back (same key, so its older
 * accessories group with the new ones); a name already in use is rejected.
 */
export function addAccessoryTag(prefs: AccessoryTagPrefs, rawLabel: string, newId: () => string): AddTagResult {
  const label = rawLabel.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
  if (!label) return { ok: false, error: 'Escribí el nombre de la etiqueta.' };
  const n = norm(label);
  const active = activeAccessoryTags(prefs).find((t) => norm(t.label) === n);
  if (active) return { ok: false, error: `Ya existe la etiqueta «${active.label}».` };
  const hiddenBuiltIn = ACCESSORY_TAGS.find((t) => prefs.hidden.includes(t.key) && norm(t.label) === n);
  if (hiddenBuiltIn) return { ok: true, key: hiddenBuiltIn.key, restored: true, prefs: { ...prefs, hidden: prefs.hidden.filter((k) => k !== hiddenBuiltIn.key) } };
  const removed = prefs.custom.find((t) => t.removed && norm(t.label) === n);
  if (removed) {
    return { ok: true, key: removed.key, restored: true, prefs: { ...prefs, custom: prefs.custom.map((t) => (t.key === removed.key ? { key: t.key, label } : t)) } };
  }
  const key = `${ACCESSORY_CATEGORY.key}.u-${newId()}`;
  return { ok: true, key, restored: false, prefs: { ...prefs, custom: [...prefs.custom, { key, label }] } };
}

/** Removes a tag from the pickers (suggested → hidden, the user's → marked removed). */
export function removeAccessoryTag(prefs: AccessoryTagPrefs, key: string): AccessoryTagPrefs {
  if (ACCESSORY_TAGS.some((t) => t.key === key)) return prefs.hidden.includes(key) ? prefs : { ...prefs, hidden: [...prefs.hidden, key] };
  return { ...prefs, custom: prefs.custom.map((t) => (t.key === key ? { ...t, removed: true } : t)) };
}

/** Brings back every suggested tag the user removed. */
export function restoreSuggestedTags(prefs: AccessoryTagPrefs): AccessoryTagPrefs {
  return { ...prefs, hidden: [] };
}
