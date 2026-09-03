import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AA_NORMAL, contrast } from '@/design/contrast';
import { space, stroke, type, type ColourName, type Palette } from '@/design/tokens';
import { useColours, useScheme } from '@/design/useColours';

/**
 * Phase 0 specimen sheet. It exists to prove both font families render on a
 * device and that every token resolves in both schemes, with the live contrast
 * ratios shown so the screen and the test cannot disagree. Phase 1 replaces
 * this route with the round screen.
 */
const INK_ROLES: readonly (readonly [Exclude<ColourName, 'buff'>, string])[] = [
  ['ink', 'primary type and pen rules'],
  ['padViolet', 'the stamp pad, both verdicts'],
  ['padTeal', 'printed rules, timer, shutter'],
  ['bleed', 'secondary and supporting text'],
];

const COPY_NAME = { light: 'top copy', dark: 'file copy' } as const;

export default function SpecimenSheet() {
  const colour = useColours();
  const scheme = useScheme();
  const styles = useMemo(() => makeStyles(colour), [colour]);

  return (
    <SafeAreaView style={styles.paper}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <Text style={styles.prompt}>something round and blue</Text>
        <View style={styles.rule} />
        <Text style={styles.label}>
          Prompt band, Archivo SemiBold. This is the size a player reads while walking.
        </Text>

        <Text style={styles.ruling}>
          A blue enamel mug. Round on every axis I can test from here. Admitted.
        </Text>
        <Text style={styles.label}>Ruling, Archivo Medium.</Text>

        <View style={styles.readoutRow}>
          <Text style={styles.countdown} accessibilityLabel="4 seconds left">
            04
          </Text>
          <Text style={styles.caseNumber}>NO. 000412</Text>
        </View>
        <Text style={styles.label}>
          The only two Martian Mono roles in the app. Both are readouts.
        </Text>

        <View style={styles.rule} />

        <Text style={styles.label}>
          Showing the {COPY_NAME[scheme]}. Ratios are measured against this sheet;{' '}
          {AA_NORMAL.toFixed(1)} to 1 is the floor.
        </Text>

        {INK_ROLES.map(([name, role]) => {
          const value = colour[name];
          const ratio = contrast(value, colour.buff);
          return (
            <View
              key={name}
              style={styles.inkRow}
              accessible
              accessibilityLabel={`${name}, ${role}, contrast ${ratio.toFixed(2)} to 1`}
            >
              <View style={[styles.swatch, { backgroundColor: value }]} />
              <View style={styles.inkText}>
                <Text style={[styles.body, { color: value }]}>{name}</Text>
                <Text style={styles.label}>
                  {role} — {ratio.toFixed(2)}:1
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    paper: { flex: 1, backgroundColor: colour.buff },
    sheet: { padding: space.roomy, gap: space.base, paddingBottom: space.vast },
    prompt: { ...type.prompt, color: colour.ink },
    ruling: { ...type.ruling, color: colour.ink, marginTop: space.base },
    body: { ...type.body },
    label: { ...type.label, color: colour.bleed },
    countdown: { ...type.countdown, color: colour.padTeal },
    caseNumber: { ...type.caseNumber, color: colour.bleed },
    readoutRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.base,
      marginTop: space.base,
      flexWrap: 'wrap',
    },
    rule: { height: stroke.rule, backgroundColor: colour.padTeal },
    inkRow: { flexDirection: 'row', gap: space.base, alignItems: 'flex-start' },
    swatch: { width: space.wide, height: space.wide, borderRadius: space.hair },
    inkText: { flex: 1, gap: space.hair },
  });
