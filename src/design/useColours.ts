import { useColorScheme } from 'react-native';

import { palette, type Palette, type Scheme } from './tokens';

/**
 * Resolves the palette for the copy the reader is holding: the top copy in
 * daylight, or the office's file copy. See DESIGN.md.
 *
 * `useColorScheme` returns null before the OS reports a preference; the top copy
 * is the default because that is the document the applicant is given.
 */
export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useColours(): Palette {
  return palette[useScheme()];
}
