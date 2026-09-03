import { type ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';

/**
 * A sheet of paper with something written on it by the judge.
 *
 * Every non-camera screen in the app is one of these: priming, permission
 * recovery, expiry, network failure, rate limit. Uniform because they are all
 * the same object — a notice from the office.
 *
 * It scrolls, because at the largest Dynamic Type setting a two-sentence notice
 * plus an action can exceed a small screen, and clipped text is the failure the
 * brief calls out by name.
 */
export type PaperScreenProps = {
  /** The judge's sentence. One or two, never more. */
  readonly ruling: string;
  /** Supporting line. Optional, and always secondary. */
  readonly note?: string;
  /** Actions. Rendered below the text, stacked. */
  readonly children?: ReactNode;
  /**
   * Announce the ruling to VoiceOver when it appears. True for anything that
   * arrived unbidden — a failure, an expiry — and false for a screen the player
   * navigated to deliberately.
   */
  readonly announce?: boolean;
};

export function PaperScreen({ ruling, note, children, announce }: PaperScreenProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);

  return (
    <SafeAreaView style={styles.paper}>
      <ScrollView
        contentContainerStyle={styles.sheet}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.rule} />
        <Text
          style={styles.ruling}
          accessibilityRole={announce === true ? 'alert' : 'header'}
          accessibilityLiveRegion={announce === true ? 'polite' : 'none'}
        >
          {ruling}
        </Text>
        {note !== undefined && <Text style={styles.note}>{note}</Text>}
        {children !== undefined && <View style={styles.actions}>{children}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    paper: { flex: 1, backgroundColor: colour.buff },
    sheet: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: space.wide,
      paddingVertical: space.vast,
      gap: space.base,
    },
    // A printed rule above the text, the way a form separates a notice from
    // whatever was above it on the page.
    rule: {
      height: stroke.rule,
      width: space.vast,
      backgroundColor: colour.padTeal,
      marginBottom: space.snug,
    },
    ruling: { ...type.ruling, color: colour.ink },
    note: { ...type.body, color: colour.bleed },
    actions: { marginTop: space.roomy, gap: space.base, alignItems: 'flex-start' },
  });
