import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import {
  configureFeedback,
  isMuted,
  play,
  resetFeedbackForTests,
  setMuted,
  thump,
} from './feedback';

beforeEach(() => {
  jest.clearAllMocks();
  resetFeedbackForTests();
});

/** The player handed out by the most recent createAudioPlayer call. */
function lastPlayer(): { seekTo: jest.Mock; play: jest.Mock } {
  const calls = (createAudioPlayer as jest.Mock).mock.results;
  const last = calls[calls.length - 1]?.value as
    { seekTo: jest.Mock; play: jest.Mock } | undefined;
  if (last === undefined) throw new Error('no player was created');
  return last;
}

describe('the audio session', () => {
  it('does NOT override the silent switch', async () => {
    // expo-audio defaults playsInSilentMode to true, which overrides the
    // physical switch. DESIGN.md says the switch is respected, so leaving the
    // default in place would be the bug. This is the test for that.
    await configureFeedback();
    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: false }),
    );
  });

  it('mixes with other audio rather than stopping the player’s music', async () => {
    await configureFeedback();
    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ interruptionMode: 'mixWithOthers' }),
    );
  });

  it('does not keep playing in the background', async () => {
    await configureFeedback();
    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ shouldPlayInBackground: false }),
    );
  });

  it('configures once, however many times it is called', async () => {
    await configureFeedback();
    await configureFeedback();
    await configureFeedback();
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  it('survives a device with no audio session', async () => {
    (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(new Error('no session'));
    await expect(configureFeedback()).resolves.toBeUndefined();
  });
});

describe('sound', () => {
  it('plays the shutter', () => {
    expect(() => play('shutter')).not.toThrow();
  });

  it('rewinds before playing, so a quick second press retriggers', () => {
    play('stamp');
    const player = lastPlayer();
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalled();
  });

  it('reuses one player per sound rather than allocating on every press', () => {
    play('shutter');
    play('shutter');
    play('shutter');
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(lastPlayer().play).toHaveBeenCalledTimes(3);
  });

  it('allocates a separate player per sound', () => {
    play('shutter');
    play('stamp');
    expect(createAudioPlayer).toHaveBeenCalledTimes(2);
  });

  it('says nothing when muted', () => {
    setMuted(true);
    play('shutter');
    play('stamp');
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('survives a player that refuses to be created', () => {
    (createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no decoder');
    });
    expect(() => play('stamp')).not.toThrow();
  });

  it('reports its own state', () => {
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(isMuted()).toBe(true);
  });
});

describe('the thump', () => {
  it('is a heavy impact, the single heaviest thing the app does', () => {
    thump();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  /**
   * Mute is about sound and reduce-motion is about movement. Neither is a
   * request for less physical feedback, so the stamp still lands in the hand.
   */
  it('still fires when the office is silenced', () => {
    setMuted(true);
    thump();
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });

  it('survives a device with no haptic engine', () => {
    (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no taptic engine');
    });
    expect(() => thump()).not.toThrow();
  });
});
