import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { motion, space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { verdictAwardsPoint, type Verdict } from '@/judge/schema';

/**
 * The ruling: the print, and the stamp that landed on it.
 *
 * The stamp reports whether the point was awarded, not the raw verdict — see
 * DESIGN.md amendment A2. That is what makes the generous tie-break visible:
 * a reject the judge is unsure of gets an ADMITTED ring above a ruling that
 * grumbles about it, which is the joke.
 *
 * Both stamps are inked in the same violet. They differ by the shape of the
 * mark and by the word, never by colour, so the distinction survives greyscale,
 * colour blindness, and a screenshot.
 *
 * Phase 4 animates the landing. The composition here is the resting state, and
 * is also exactly what a player with reduce-motion enabled sees.
 */
export type RulingProps = {
  readonly verdict: Verdict;
  readonly imageUri: string;
  /** Printed on the stamp. A readout, which is why it is set in mono. */
  readonly caseNumber: string;
};

export function Ruling({ verdict, imageUri, caseNumber }: RulingProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const awarded = verdictAwardsPoint(verdict);
  const word = awarded ? 'ADMITTED' : 'NOT ADMITTED';

  return (
    <View style={styles.sheet}>
      <Image
        source={{ uri: imageUri }}
        style={styles.print}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Your photograph of ${verdict.detected}`}
      />

      <View
        style={[styles.stamp, awarded ? styles.stampRing : styles.stampBar]}
        accessibilityRole="image"
        accessibilityLabel={awarded ? 'Stamped admitted' : 'Stamped not admitted'}
      >
        <Text style={styles.stampFace} allowFontScaling={false}>
          {word}
        </Text>
        <Text style={styles.caseNumber} allowFontScaling={false}>
          {caseNumber}
        </Text>
      </View>

      {/*
        The ruling is announced rather than merely rendered: it is the point of
        the screen, and it arrives after the player has stopped looking.
      */}
      <Text
        style={styles.ruling}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        {verdict.reason}
      </Text>
    </View>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    sheet: { gap: space.roomy, alignItems: 'center' },
    print: {
      width: '100%',
      aspectRatio: 1,
      borderWidth: stroke.rule,
      borderColor: colour.bleed,
    },
    stamp: {
      borderWidth: stroke.stamp,
      borderColor: colour.padViolet,
      paddingVertical: space.snug,
      paddingHorizontal: space.roomy,
      alignItems: 'center',
      gap: space.hair,
      transform: [{ rotate: `${motion.stampTiltDeg}deg` }],
      // The stamp sits over the lower edge of the print, the way a real one
      // lands where the clerk's hand happened to be.
      marginTop: -space.vast,
    },
    /** The point was awarded. A round die. */
    stampRing: { borderRadius: space.vast },
    /** The point was withheld. A bar die. Square corners, same ink. */
    stampBar: { borderRadius: 0 },
    stampFace: { ...type.stampFace, color: colour.padViolet },
    caseNumber: { ...type.caseNumber, color: colour.padViolet },
    ruling: { ...type.ruling, color: colour.ink, textAlign: 'center' },
  });
