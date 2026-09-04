import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

/**
 * Player preferences. Currently one: whether the office makes any noise.
 *
 * Validated on the way in like everything else read from storage; a corrupt
 * value degrades to the default rather than crashing.
 */

const KEY = 'snap-hunt.settings.v1';

export const SettingsSchema = z.object({
  version: z.literal(1),
  muted: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  version: 1,
  // Sound is on by default, but the device's silent switch is respected, so a
  // phone on silent stays silent without anyone changing anything here.
  muted: false,
});

export function parseSettings(stored: string | null): Settings {
  if (stored === null) return DEFAULT_SETTINGS;
  try {
    const parsed = SettingsSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    return parseSettings(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
