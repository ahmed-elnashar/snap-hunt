import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';

/**
 * The running record, set out like the summary block at the foot of a form.
 *
 * Figures are mono because they are figures in a column — see DESIGN.md A3.
 * Labels are Archivo, because they are words.
 */
export type TallyEntry = {
  readonly label: string;
  readonly value: string;
  /** Spoken instead of the label and value, when reading them aloud is wrong. */
  readonly accessibilityLabel: string;
};

export type TallyProps = {
  readonly entries: readonly TallyEntry[];
};

export function Tally({ entries }: TallyProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);

  return (
    <View style={styles.block}>
      <View style={styles.rule} />
      <View style={styles.row}>
        {entries.map((entry) => (
          <View
            key={entry.label}
            style={styles.cell}
            accessible
            accessibilityLabel={entry.accessibilityLabel}
          >
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {entry.value}
            </Text>
            <Text style={styles.label}>{entry.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    block: { width: '100%', gap: space.base },
    rule: { height: stroke.rule, backgroundColor: colour.padTeal },
    row: { flexDirection: 'row', gap: space.roomy },
    cell: { flex: 1, gap: space.hair },
    value: { ...type.tally, color: colour.ink },
    label: { ...type.label, color: colour.bleed },
  });
