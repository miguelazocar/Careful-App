import { activeAccessoryTags, addAccessoryTag, DEFAULT_ACCESSORY_TAG_PREFS, removeAccessoryTag, resolveAccessoryTag, restoreSuggestedTags, type AccessoryTagPrefs } from '../accessory-tags';

const id = () => 'abc';
const labels = (p: AccessoryTagPrefs) => activeAccessoryTags(p).map((t) => t.label);

describe('accessory tags', () => {
  it('starts with the suggested tags', () => {
    expect(labels(DEFAULT_ACCESSORY_TAG_PREFS)).toContain('Luces');
    expect(activeAccessoryTags().every((t) => !t.custom)).toBe(true);
  });

  it('adds your own tags after the suggested ones, and rejects names already in use', () => {
    const r = addAccessoryTag(DEFAULT_ACCESSORY_TAG_PREFS, '  Portabicicletas ', id);
    expect(r).toMatchObject({ ok: true, key: 'accesorios.u-abc', restored: false });
    if (!r.ok) throw new Error();
    expect(labels(r.prefs).at(-1)).toBe('Portabicicletas');
    expect(activeAccessoryTags(r.prefs).at(-1)).toMatchObject({ custom: true, icon: 'tag' });
    expect(addAccessoryTag(r.prefs, 'PORTABICICLETAS', id)).toEqual({ ok: false, error: 'Ya existe la etiqueta «Portabicicletas».' });
    expect(addAccessoryTag(r.prefs, 'estereo', id)).toEqual({ ok: false, error: 'Ya existe la etiqueta «Estéreo».' });
    expect(addAccessoryTag(r.prefs, '   ', id).ok).toBe(false);
  });

  it('removing hides a tag from the pickers but older records keep its name', () => {
    const added = addAccessoryTag(DEFAULT_ACCESSORY_TAG_PREFS, 'Portabicicletas', id);
    if (!added.ok) throw new Error();
    let p = removeAccessoryTag(added.prefs, 'accesorios.u-abc');
    p = removeAccessoryTag(p, 'accesorios.luces');
    expect(labels(p)).not.toContain('Portabicicletas');
    expect(labels(p)).not.toContain('Luces');
    expect(resolveAccessoryTag('accesorios.u-abc', p)?.label).toBe('Portabicicletas');
    expect(resolveAccessoryTag('accesorios.luces', p)?.label).toBe('Luces');
    expect(resolveAccessoryTag('accesorios.otro', p)).toBeUndefined();
  });

  it('adding a removed name brings the same tag back, and the suggested ones can be restored', () => {
    const added = addAccessoryTag(DEFAULT_ACCESSORY_TAG_PREFS, 'Portabicicletas', id);
    if (!added.ok) throw new Error();
    const removed = removeAccessoryTag(removeAccessoryTag(added.prefs, 'accesorios.u-abc'), 'accesorios.luces');
    const back = addAccessoryTag(removed, 'portabicicletas', () => 'zzz');
    expect(back).toMatchObject({ ok: true, key: 'accesorios.u-abc', restored: true });
    const luces = addAccessoryTag(removed, 'luces', () => 'zzz');
    expect(luces).toMatchObject({ ok: true, key: 'accesorios.luces', restored: true });
    expect(labels(restoreSuggestedTags(removed))).toContain('Luces');
  });
});
