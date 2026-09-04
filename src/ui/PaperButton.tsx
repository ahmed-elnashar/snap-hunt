import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';

/**
 * A box on a form that you put a mark in.
 *
 * Square corners, a printed rule for a border, and no arrow appended to the
 * label. Pressing it inks the box: the fill and the text swap, which is what a
 * stamp does to paper and is also a state change that survives greyscale.
 *
 * Height comes from padding rather than a fixed value, so the tap target grows
 * with Dynamic Type instead of clipping the label.
 */
export type PaperButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  /** Spoken by VoiceOver after the label, to say what happens next. */
  readonly hint?: string;
  readonly disabled?: boolean;
};

export function PaperButton({ label, onPress, hint, disabled }: PaperButtonProps) {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const isDisabled = disabled === true;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint === undefined ? {} : { accessibilityHint: hint })}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.box,
        pressed && !isDisabled && styles.boxPressed,
        isDisabled && styles.boxDisabled,
      ]}
    >
      {({ pressed }) => (
        <View>
          <Text
            style={[
              styles.label,
              pressed && !isDisabled && styles.labelPressed,
              isDisabled && styles.labelDisabled,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    box: {
      borderWidth: stroke.rule,
      borderColor: colour.padTeal,
      paddingVertical: space.base,
      paddingHorizontal: space.roomy,
      backgroundColor: colour.buff,
      // Above the minimum, not merely at it; the assertion is in the test.
      minHeight: 48,
      justifyContent: 'center',
    },
    boxPressed: { backgroundColor: colour.padTeal },
    boxDisabled: { borderColor: colour.bleed },
    label: { ...type.body, color: colour.ink },
    labelPressed: { color: colour.buff },
    labelDisabled: { color: colour.bleed },
  });
