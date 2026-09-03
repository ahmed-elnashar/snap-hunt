import type { ExpoConfig } from 'expo/config';

/**
 * No secret is permitted in this file. The Anthropic API key lives only in the
 * server environment read by app/api/judge+api.ts. See README "Security".
 *
 * `userInterfaceStyle: 'light'` is a design decision, not an oversight: the app
 * has no dark mode because paper does not have one. See DESIGN.md.
 */
const config: ExpoConfig = {
  name: 'Snap Hunt',
  slug: 'snap-hunt',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'snaphunt',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.snaphunt.game',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  web: {
    // Required for Expo Router API routes (app/api/judge+api.ts) to be bundled.
    output: 'server',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        // Honest, and in the judge's voice. See DESIGN.md.
        cameraPermission:
          'The judge cannot rule on a photograph it has not been shown. Snap Hunt uses the camera only to take the picture you submit for a verdict.',
        recordAudioAndroid: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
