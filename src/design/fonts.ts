import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { MartianMono_400Regular } from '@expo-google-fonts/martian-mono/400Regular';
import { MartianMono_600SemiBold } from '@expo-google-fonts/martian-mono/600SemiBold';

/**
 * The six faces the app loads, and the only six it bundles.
 *
 * These are per-weight deep imports on purpose. Importing from the package root
 * pulls every weight into the bundle — 26 files and ~3.5 MB for Archivo alone,
 * of which we use four.
 *
 * Both families are SIL Open Font License 1.1, which permits embedding in
 * shipped software. Verified in each package's LICENSE_FONT, not assumed.
 */
export const fontAssets = {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  MartianMono_400Regular,
  MartianMono_600SemiBold,
} as const;

export type LoadedFontName = keyof typeof fontAssets;
