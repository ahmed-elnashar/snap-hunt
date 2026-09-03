import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colour, space, stroke, type } from '@/design/tokens';

/**
 * Phase 0 specimen sheet. It exists to prove both font families render on a
 * device and that every token resolves. Phase 1 replaces this route with the
 * round screen.
 */
const INKS = [
  ['ink', colour.ink, 'primary type and pen rules', '15.1:1'],
  ['padViolet', colour.padViolet, 'the stamp pad, both verdicts', '7.66:1'],
  ['padTeal', colour.padTeal, 'printed rules, timer, shutter', '5.67:1'],
  ['bleed', colour.bleed, 'secondary and supporting text', '4.72:1'],
] as const;

export default function SpecimenSheet() {
  return (
    <SafeAreaView style={styles.paper}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <Text style={styles.prompt}>something round and blue</Text>
        <View style={styles.rule} />
        <Text style={styles.label}>
          Prompt band, Archivo SemiBold. This is the size a player reads while walking.
        </Text>

        <Text style={styles.ruling}>
          A blue enamel mug, and it is unambiguously round. Admitted.
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

        {INKS.map(([name, value, role, contrast]) => (
          <View key={name} style={styles.inkRow}>
            <View style={[styles.swatch, { backgroundColor: value }]} />
            <View style={styles.inkText}>
              <Text style={[styles.body, { color: value }]}>{name}</Text>
              <Text style={styles.label}>
                {role} — {contrast} on buff
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
