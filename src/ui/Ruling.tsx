import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { motion, space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { useMotion } from '@/design/useMotion';
import { play, thump } from '@/feedback/feedback';
import { verdictAwardsPoint, type Verdict } from '@/judge/schema';

/**
 * The one orchestrated moment in the app: the print develops, and the stamp
 * lands on it.
 *
 * The develop is not a loading state dressed up — it *is* the wait. The veil is
 * buff, so the photograph emerges from the paper it is printed on rather than
 * fading up from nothing. It stops short of clear while the judge is still
 * looking and only completes when the ruling arrives, because measured latency
 * is a median of 2.0s and a fixed develop would finish early and leave a
 * developed print sitting under nothing.
 *
 * The stamp reports whether the point was awarded, not the raw verdict — see
 * DESIGN.md A2. Both dies are inked in the same violet and differ by the shape
 * of the mark and by the word, so the distinction survives greyscale, colour
 * blindness and a screenshot.
 */

/** How far the develop gets before the ruling arrives. Never quite clear. */
const HELD_VEIL = 0.3;

/** Pause after the print clears, before the die comes down. */
const STRIKE_DELAY_MS = 220;

export type RulingProps = {
  /** Null while the judge is still looking. */
  readonly verdict: Verdict | null;
  readonly imageUri: string;
  /** Printed on the stamp. A readout, which is why it is set in mono. */
  readonly caseNumber: string;
};

export function Ruling({ verdict, imageUri, caseNumber }: RulingProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const { reduced } = useMotion();

  const veil = useSharedValue(1);
  const struck = useSharedValue(0);

  const ruled = verdict !== null;
  const awarded = verdict !== null && verdictAwardsPoint(verdict);

  useEffect(() => {
    if (reduced) {
      veil.value = 0;
      return;
    }
    veil.value = withTiming(ruled ? 0 : HELD_VEIL, {
      duration: ruled ? 300 : motion.develop,
      easing: Easing.out(Easing.quad),
    });
  }, [ruled, reduced, veil]);

  useEffect(() => {
    if (!ruled) return;

    if (reduced) {
      // The composed still: already landed, still tilted, still off-register.
      // The haptic and the sound are not motion and are not withheld.
      struck.value = 1;
      thump();
      play('stamp');
      return;
    }

    struck.value = withDelay(
      STRIKE_DELAY_MS,
      withTiming(1, { duration: motion.strike, easing: Easing.out(Easing.cubic) }),
    );

    // Fired at contact rather than at the start of the travel, so the thump
    // lands with the die and not before it.
    const contact = setTimeout(
      () => {
        thump();
        play('stamp');
      },
      STRIKE_DELAY_MS + Math.round(motion.strike * 0.7),
    );
    return () => clearTimeout(contact);
  }, [ruled, reduced, struck]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: struck.value,
    transform: [
      { rotate: `${motion.stampTiltDeg}deg` },
      // Comes down from above the page and stops hard.
      { scale: 1 + (1 - struck.value) * 1.5 },
    ],
  }));

  return (
    <View style={styles.sheet}>
      <View style={styles.printFrame}>
        <Image
          source={{ uri: imageUri }}
          style={styles.print}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            verdict === null
              ? 'Your photograph, developing'
              : `Your photograph of ${verdict.detected}`
          }
        />
        <Animated.View
          style={[styles.veil, veilStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>

      {ruled && (
        <Animated.View
          testID="ruling-stamp"
          style={[styles.stamp, awarded ? styles.stampRing : styles.stampBar, stampStyle]}
          accessibilityRole="image"
          accessibilityLabel={awarded ? 'Stamped admitted' : 'Stamped not admitted'}
        >
          <Text style={styles.stampFace} allowFontScaling={false}>
            {awarded ? 'ADMITTED' : 'NOT ADMITTED'}
          </Text>
          <Text style={styles.caseNumber} allowFontScaling={false}>
            {caseNumber}
          </Text>
        </Animated.View>
      )}

      {/*
        The ruling is announced rather than merely rendered: it is the point of
        the screen, and it arrives after the player has stopped looking at it.
        Capped at three lines so a long reason cannot grow the card unbounded —
        the schema's 140 characters is a backstop, not a layout guarantee.
      */}
      <Text
        style={styles.ruling}
        numberOfLines={3}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        {verdict === null ? 'The judge is looking.' : verdict.reason}
      </Text>
    </View>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    sheet: { gap: space.roomy, alignItems: 'center' },
    printFrame: {
      width: '100%',
      aspectRatio: 1,
      borderWidth: stroke.rule,
      borderColor: colour.bleed,
    },
    print: { width: '100%', height: '100%' },
    // Buff, not black: the photograph emerges from the paper, not from nothing.
    veil: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colour.buff,
    },
    stamp: {
      borderWidth: stroke.stamp,
      borderColor: colour.padViolet,
      paddingVertical: space.snug,
      paddingHorizontal: space.roomy,
      alignItems: 'center',
      gap: space.hair,
      // Lands over the lower edge of the print, where a clerk's hand would be.
      marginTop: -space.vast,
      backgroundColor: colour.buff,
    },
    /** The point was awarded. A round die. */
    stampRing: { borderRadius: space.vast },
    /** The point was withheld. A bar die. Square corners, same ink. */
    stampBar: { borderRadius: 0 },
    stampFace: { ...type.stampFace, color: colour.padViolet },
    caseNumber: { ...type.caseNumber, color: colour.padViolet },
    ruling: { ...type.ruling, color: colour.ink, textAlign: 'center' },
  });
