import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { DeviceIdSchema } from '@/judge/wire';

/**
 * An anonymous identifier, used for one thing: telling the rate limiter that
 * two requests came from the same phone.
 *
 * It is a random UUID. It is not derived from anything about the device or the
 * person, it is never sent anywhere but our own rate limiter, and deleting the
 * app deletes it. There is no analytics SDK in this project and this is not one.
 */

const KEY = 'snap-hunt.device-id';

/** Survives a failed keychain so a round is never blocked by storage. */
let inMemory: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (inMemory !== null) return inMemory;

  try {
    const stored = await SecureStore.getItemAsync(KEY);
    // Anything read back from storage crosses a boundary and is validated.
    // A corrupt or truncated value is replaced rather than trusted.
    const valid = DeviceIdSchema.safeParse(stored);
    if (valid.success) {
      inMemory = valid.data;
      return valid.data;
    }
  } catch {
    // Keychain unavailable. Fall through and mint one for this session.
  }

  const minted = Crypto.randomUUID();
  inMemory = minted;

  try {
    await SecureStore.setItemAsync(KEY, minted);
  } catch {
    // Not persisted. The player gets a fresh allowance next launch, which is
    // the harmless direction for this to fail in.
  }

  return minted;
}

/** Test seam. Not called by the app. */
export function resetDeviceIdCache(): void {
  inMemory = null;
}
