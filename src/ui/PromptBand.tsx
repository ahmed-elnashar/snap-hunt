import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';

/**
 * The band of paper laid across the top of the live preview, carrying the thing
 * you have to find.
 *
 * Opaque on purpose. Type never sits on the preview, which is uncontrollable
 * content — it can be a white wall or a night street — so legibility cannot be
 * a function of what the camera happens to be pointed at. This costs preview
 * area, and that is the trade the design makes.
 */
export type PromptBandProps = {
  readonly prompt: string;
  /** Safe-area inset to absorb, so the band reaches the top of the screen. */
  readonly topInset: number;
  /**
   * Fraction of time remaining, 0 to 1. The rule under the prompt retracts as
   * it falls. Phase 3 drives this from the round clock.
   */
  readonly remaining?: number;
};

export function PromptBand({ prompt, topInset, remaining = 1 }: PromptBandProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const clamped = Math.min(1, Math.max(0, remaining));

  return (
    <View style={[styles.band, { paddingTop: topInset + space.base }]}>
      <Text style={styles.prompt} accessibilityRole="header">
        {prompt}
      </Text>
      <View style={styles.track}>
        <View
          style={[styles.rule, { flex: clamped }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </View>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    band: {
      backgroundColor: colour.buff,
      paddingHorizontal: space.roomy,
      paddingBottom: space.base,
      gap: space.base,
    },
    prompt: { ...type.prompt, color: colour.ink },
    track: { height: stroke.timer, flexDirection: 'row' },
    rule: { backgroundColor: colour.padTeal },
  });
