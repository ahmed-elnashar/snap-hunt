import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from './settings';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('parseSettings', () => {
  it('defaults to sound on, because the silent switch already covers silence', () => {
    expect(DEFAULT_SETTINGS.muted).toBe(false);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('reads a stored preference', () => {
    const muted = { version: 1, muted: true };
    expect(parseSettings(JSON.stringify(muted))).toEqual(muted);
  });

  it.each([
    ['truncated JSON', '{"version":1,"mut'],
    ['not JSON', 'nope'],
    ['an array', '[]'],
    ['a wrong-typed flag', '{"version":1,"muted":"yes"}'],
    ['a future version', '{"version":2,"muted":true}'],
    ['a missing field', '{"version":1}'],
  ])('degrades to the default for %s', (_label, stored) => {
    expect(parseSettings(stored)).toEqual(DEFAULT_SETTINGS);
  });

  it('never throws', () => {
    for (const stored of ['{', '}', '', '"', 'null']) {
      expect(() => parseSettings(stored)).not.toThrow();
    }
  });
});

describe('storage round trip', () => {
  it('remembers a silenced office across a relaunch', async () => {
    expect(await saveSettings({ version: 1, muted: true })).toBe(true);
    expect(await loadSettings()).toEqual({ version: 1, muted: true });
  });

  it('starts from the default on a fresh install', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('degrades to the default when storage throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reports a failed write rather than throwing at the player', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    expect(await saveSettings({ version: 1, muted: true })).toBe(false);
  });
});
