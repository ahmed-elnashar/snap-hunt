import type { ExpoConfig } from 'expo/config';

/**
 * No secret is permitted in this file. The Anthropic API key lives only in the
 * server environment read by app/api/judge+api.ts. See README "Security".
 *
 * The app follows the system scheme: light is the applicant's top copy, dark is
 * the office's file copy of the same form. See DESIGN.md.
 */
const config: ExpoConfig = {
  name: 'Snap Hunt',
  slug: 'snap-hunt',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'snaphunt',
  userInterfaceStyle: 'automatic',
  // 1024x1024, no alpha, no baked corner radius. Generated and inspected at
  // 180/120/60 by scripts/make-icon.swift; the renders are in docs/icon/.
  icon: './assets/icon.png',
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
      'expo-splash-screen',
      {
        // The stamp on the paper it is about to hit. The dark variant is the
        // file copy — see DESIGN.md amendment A1.
        image: './assets/splash-mark.png',
        imageWidth: 160,
        // These two hex values are the ONLY ones outside tokens.ts. Expo
        // transpiles this file on its own and cannot resolve a .ts import at
        // runtime, so the palette cannot be imported here. Drift is prevented
        // instead by src/design/splash.test.ts, which fails the build if these
        // stop matching palette.light.buff and palette.dark.buff.
        backgroundColor: '#E8DCC4',
        dark: {
          image: './assets/splash-mark-dark.png',
          backgroundColor: '#2B2722',
        },
      },
    ],
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
