import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { space, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';

const DIAMETER = 76;
const RING = 4;

/**
 * The act of submitting. A ring, inked when pressed.
 *
 * Deliberately not a filled white disc: this is a form being handed in, not a
 * camera app. It sits on the opaque lower band, never over the live preview, so
 * it stays visible against any scene.
 */
export type ShutterProps = {
  readonly onPress: () => void;
  /** True while a photograph is being prepared or judged. */
  readonly busy?: boolean;
};

export function Shutter({ onPress, busy }: ShutterProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const isBusy = busy === true;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel="Submit a photograph"
      accessibilityHint={
        isBusy
          ? 'The office is dealing with your last submission.'
          : 'Takes the photograph and hands it to the judge.'
      }
      accessibilityState={{ disabled: isBusy, busy: isBusy }}
      hitSlop={space.base}
      style={({ pressed }) => [
        styles.ring,
        pressed && !isBusy && styles.ringInked,
        isBusy && styles.ringBusy,
      ]}
    >
      <View />
    </Pressable>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    ring: {
      width: DIAMETER,
      height: DIAMETER,
      borderRadius: DIAMETER / 2,
      borderWidth: RING,
      borderColor: colour.padTeal,
      backgroundColor: colour.buff,
    },
    ringInked: { backgroundColor: colour.padTeal },
    ringBusy: { borderColor: colour.bleed },
  });
