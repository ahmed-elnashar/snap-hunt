import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { NUMERAL_THRESHOLD_MS, ROUND_MS } from '@/game/scoring';

/**
 * The band of paper laid across the top of the live preview, carrying the thing
 * you have to find and the time you have left.
 *
 * Opaque on purpose. Type never sits on the preview, which is uncontrollable
 * content — it can be a white wall or a night street — so legibility cannot be
 * a function of what the camera happens to be pointed at. This costs preview
 * area, and that is the trade the design makes.
 *
 * The clock is a rule that retracts, not a number that counts. It is glanced
 * at while the player is physically moving. The numeral appears only in the
 * last five seconds, which is where a monospace readout is earned rather than
 * decorative.
 */
export type PromptBandProps = {
  readonly prompt: string;
  /** Safe-area inset to absorb, so the band reaches the top of the screen. */
  readonly topInset: number;
  /** Milliseconds left, or null when the round is untimed. */
  readonly remainingMs: number | null;
  /** Marks the round as today's challenge. */
  readonly isDaily?: boolean;
};

export function PromptBand({ prompt, topInset, remainingMs, isDaily }: PromptBandProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);

  const untimed = remainingMs === null;
  const fraction = untimed ? 1 : Math.min(1, Math.max(0, remainingMs / ROUND_MS));
  const seconds = untimed ? null : Math.ceil(remainingMs / 1000);
  const showNumeral = !untimed && remainingMs <= NUMERAL_THRESHOLD_MS;

  return (
    <View
      testID="prompt-band"
      style={[styles.band, { paddingTop: topInset + space.base }]}
    >
      {isDaily === true && <Text style={styles.label}>Today&apos;s submission</Text>}

      <View style={styles.line}>
        <Text style={styles.prompt} accessibilityRole="header">
          {prompt}
        </Text>
        {showNumeral && (
          <Text
            style={styles.countdown}
            allowFontScaling={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {String(seconds).padStart(2, '0')}
          </Text>
        )}
      </View>

      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={
          untimed
            ? 'No time limit on this round'
            : `${seconds} second${seconds === 1 ? '' : 's'} left`
        }
      >
        {/* flexGrow below 1 takes that share of the track and leaves the
            rest as bare paper, which is the rule having been used up. */}
        <View
          style={[styles.rule, { flex: fraction }]}
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
      gap: space.snug,
    },
    label: { ...type.label, color: colour.bleed },
    line: { flexDirection: 'row', alignItems: 'flex-end', gap: space.base },
    prompt: { ...type.prompt, color: colour.ink, flex: 1 },
    countdown: { ...type.countdown, color: colour.padTeal },
    track: { height: stroke.timer, flexDirection: 'row' },
    rule: { backgroundColor: colour.padTeal },
  });
