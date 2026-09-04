/**
 * expo-audio under Jest.
 *
 * The real module reads a native class prototype at import time and throws
 * without one. Only the three things the app uses are mocked.
 */
module.exports = {
  __esModule: true,

  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    remove: jest.fn(),
  })),

  setAudioModeAsync: jest.fn(async () => undefined),
  setIsAudioActiveAsync: jest.fn(async () => undefined),
};
