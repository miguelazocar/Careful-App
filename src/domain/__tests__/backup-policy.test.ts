/// <reference types="jest" />
import { backupDateFromName, backupFileName, backupsToPrune, connectionAllowsUpload, isBackupFileName, isDailyBackupDue } from '../backup-policy';

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

describe('isDailyBackupDue', () => {
  const now = new Date(2026, 10, 11, 0, 20); // 11 nov, 00:20 local
  it('is due when there was never a backup or the date is invalid', () => {
    expect(isDailyBackupDue(null, now)).toBe(true);
    expect(isDailyBackupDue('garbage', now)).toBe(true);
  });
  it('runs once per day, at the first chance after midnight', () => {
    expect(isDailyBackupDue(new Date(2026, 10, 10, 23, 59).toISOString(), now)).toBe(true);
    expect(isDailyBackupDue(new Date(2026, 10, 11, 0, 5).toISOString(), now)).toBe(false);
    expect(isDailyBackupDue(new Date(2026, 10, 11, 0, 5).toISOString(), new Date(2026, 10, 11, 22, 0))).toBe(false);
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
  const now = new Date(2026, 10, 11, 12, 0);
  const name = (d: number, hhmm: string) => `careful-respaldo-2026-11-${String(d).padStart(2, '0')}_${hhmm}.zip`;

  it('keeps the most recent ones and never touches other files', () => {
    const files = [f(name(11, '0900')), f('otra-cosa.zip'), f(name(11, '0800'))];
    expect(backupsToPrune(files, { recent: 5, days: 14 }, now)).toEqual([]);
  });

  it('a burst of edits keeps the 5 newest plus the newest backup of each day', () => {
    const today = Array.from({ length: 12 }, (_, i) => f(name(11, `10${String(i).padStart(2, '0')}`)));
    const older = [f(name(10, '2300')), f(name(10, '0900')), f(name(9, '1200'))];
    const pruned = backupsToPrune([...today, ...older], { recent: 5, days: 14 }, now).map((x) => x.name);
    // kept: 10:11…10:07 (5 newest, they also cover today), the 10th at 23:00, the 9th
    expect(pruned).toEqual([...['1006', '1005', '1004', '1003', '1002', '1001', '1000'].map((h) => name(11, h)), name(10, '0900')]);
  });

  it('drops days older than the window and always keeps the newest', () => {
    const files = [f(name(11, '0900')), f('careful-respaldo-2026-10-01_0900.zip')];
    expect(backupsToPrune(files, { recent: 1, days: 14 }, now).map((x) => x.name)).toEqual(['careful-respaldo-2026-10-01_0900.zip']);
    expect(backupsToPrune([f(name(1, '0900'))], { recent: 0, days: 1 }, now)).toEqual([]);
  });

  it('breaks same-minute ties by creation time', () => {
    const twins = [f(name(11, '0900'), '2026-11-11T12:00:10Z'), f(name(11, '0900'), '2026-11-11T12:00:50Z')];
    expect(backupsToPrune(twins, { recent: 1, days: 0 }, now)[0].createdTime).toBe('2026-11-11T12:00:10Z');
  });
});
