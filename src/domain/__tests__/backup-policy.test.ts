/// <reference types="jest" />
import { backupDateFromName, backupFileName, connectionAllowsUpload, isBackupFileName, isDailyBackupDue, staleBackups } from '../backup-policy';

describe('backup file names', () => {
  it('is always the same single file', () => {
    expect(backupFileName()).toBe('careful-respaldo.zip');
  });

  it('recognises our files, old dated copies and provider renames, and nothing else', () => {
    expect(isBackupFileName('careful-respaldo.zip')).toBe(true);
    expect(isBackupFileName('careful-respaldo-2026-11-07_2136.zip')).toBe(true);
    expect(isBackupFileName('careful-respaldo (1).zip')).toBe(true);
    expect(isBackupFileName('careful-respaldo-notas.txt')).toBe(false);
    expect(isBackupFileName('foto.zip')).toBe(false);
  });

  it('still reads the date of old dated copies', () => {
    const d = backupDateFromName('careful-respaldo-2026-11-07_2136.zip');
    expect([d?.getFullYear(), d?.getMonth(), d?.getHours()]).toEqual([2026, 10, 21]);
    expect(backupDateFromName('careful-respaldo.zip')).toBeNull();
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

describe('staleBackups', () => {
  it('lists every backup except the one kept, never other files', () => {
    const current = { name: 'careful-respaldo.zip' };
    const files = [current, { name: 'careful-respaldo-2026-11-07_2136.zip' }, { name: 'careful-respaldo (1).zip' }, { name: 'otra-cosa.zip' }, { name: 'foto.jpg' }];
    expect(staleBackups(files, current).map((f) => f.name)).toEqual(['careful-respaldo-2026-11-07_2136.zip', 'careful-respaldo (1).zip']);
    expect(staleBackups(files).map((f) => f.name)).toEqual(['careful-respaldo.zip', 'careful-respaldo-2026-11-07_2136.zip', 'careful-respaldo (1).zip']);
  });
});
