/// <reference types="jest" />
import { backupDateFromName, backupFileName, backupsToPrune, connectionAllowsUpload, isBackupFileName, isDue } from '../backup-policy';

describe('backup file names', () => {
  it('encodes the local date and time, sortable', () => {
    expect(backupFileName(new Date(2026, 10, 7, 21, 36))).toBe('careful-respaldo-2026-11-07_2136.zip');
    expect(backupFileName(new Date(2026, 0, 2, 3, 4))).toBe('careful-respaldo-2026-01-02_0304.zip');
  });

  it('round-trips the date and rejects foreign files', () => {
    const d = backupDateFromName('careful-respaldo-2026-11-07_2136.zip');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(10);
    expect(d?.getHours()).toBe(21);
    expect(backupDateFromName('foto.jpg')).toBeNull();
    expect(isBackupFileName('careful-respaldo-2026-11-07_2136.zip')).toBe(true);
    expect(isBackupFileName('careful-respaldo-notas.txt')).toBe(false);
  });
});

describe('isDue', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  it('is due when there was never a backup or the date is invalid', () => {
    expect(isDue(null, 24, now)).toBe(true);
    expect(isDue('garbage', 24, now)).toBe(true);
  });
  it('respects the interval with a one-minute tolerance for early workers', () => {
    expect(isDue('2026-11-06T12:00:00Z', 24, now)).toBe(true);
    expect(isDue('2026-11-06T12:00:30Z', 24, now)).toBe(true);
    expect(isDue('2026-11-06T13:00:00Z', 24, now)).toBe(false);
    expect(isDue('2026-11-07T11:30:00Z', 1, now)).toBe(false);
  });
});

describe('connectionAllowsUpload', () => {
  it('Wi-Fi only never uses mobile data or unknown links', () => {
    expect(connectionAllowsUpload('wifi', true)).toBe(true);
    expect(connectionAllowsUpload('cellular', true)).toBe(false);
    expect(connectionAllowsUpload('other', true)).toBe(false);
  });
  it('without the restriction any link works, but not offline', () => {
    expect(connectionAllowsUpload('cellular', false)).toBe(true);
    expect(connectionAllowsUpload('other', false)).toBe(true);
    expect(connectionAllowsUpload('none', false)).toBe(false);
  });
});

describe('backupsToPrune', () => {
  const f = (name: string, createdTime = '') => ({ name, createdTime });
  const files = [
    f('careful-respaldo-2026-11-05_1000.zip'),
    f('careful-respaldo-2026-11-07_0900.zip'),
    f('otra-cosa.zip'),
    f('careful-respaldo-2026-11-06_1000.zip'),
  ];

  it('keeps the newest N of our own backups and never touches other files', () => {
    expect(backupsToPrune(files, 2).map((x) => x.name)).toEqual(['careful-respaldo-2026-11-05_1000.zip']);
    expect(backupsToPrune(files, 10)).toEqual([]);
  });

  it('always keeps at least one', () => {
    expect(backupsToPrune(files, 0).map((x) => x.name)).toEqual(['careful-respaldo-2026-11-06_1000.zip', 'careful-respaldo-2026-11-05_1000.zip']);
  });

  it('breaks same-minute ties by creation time', () => {
    const twins = [f('careful-respaldo-2026-11-07_0900.zip', '2026-11-07T12:00:10Z'), f('careful-respaldo-2026-11-07_0900.zip', '2026-11-07T12:00:50Z')];
    expect(backupsToPrune(twins, 1)[0].createdTime).toBe('2026-11-07T12:00:10Z');
  });
});
