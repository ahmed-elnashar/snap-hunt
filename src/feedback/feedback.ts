import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Everything the app does to your senses, in one place: two sounds and one
 * haptic. DESIGN.md caps it there and concentrates all of it on the verdict.
 *
 * Nothing here throws into a round. A device with no audio hardware, a denied
 * haptic engine or a failed decode should cost the player nothing.
 */

export type SoundName = 'shutter' | 'stamp';

const SOURCES: Record<SoundName, number> = {
  // Synthesised by scripts/make-sounds.mjs, so their provenance is this repo.
  shutter: require('@/assets/audio/shutter.wav') as number,
  stamp: require('@/assets/audio/stamp.wav') as number,
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let muted = false;
let configured = false;

/**
 * Prepares the audio session.
 *
 * `playsInSilentMode` defaults to TRUE in expo-audio, which overrides the
 * device's silent switch. DESIGN.md says the switch is respected, so this must
 * be set to false deliberately — leaving the default in place would be the bug.
 *
 * `mixWithOthers` means the app never stops the player's music for a click.
 */
export async function configureFeedback(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
  } catch {
    // No audio session. The app plays on in silence.
  }
}

export function setMuted(next: boolean): void {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

function playerFor(name: SoundName): AudioPlayer | null {
  const existing = players[name];
  if (existing !== undefined) return existing;
  try {
    const created = createAudioPlayer(SOURCES[name]);
    players[name] = created;
    return created;
  } catch {
    return null;
  }
}

export function play(name: SoundName): void {
  if (muted) return;
  const player = playerFor(name);
  if (player === null) return;
  try {
    // Rewind first: a second press inside the tail should retrigger, not be
    // swallowed because the player is already at the end.
    player.seekTo(0);
    player.play();
  } catch {
    // A sound that will not play is not worth interrupting a round for.
  }
}

/**
 * The stamp landing. The single heaviest thing the app does, at the single
 * moment that earns it.
 *
 * Fires even when muted and even with reduce-motion enabled: mute is about
 * sound and reduce-motion is about movement, and neither is a request for less
 * physical feedback.
 */
export function thump(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // No haptic engine. Nothing to do and nothing to report.
  }
}

/** Test seam. Not called by the app. */
export function resetFeedbackForTests(): void {
  muted = false;
  configured = false;
  for (const key of Object.keys(players) as SoundName[]) delete players[key];
}
