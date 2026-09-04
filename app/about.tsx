import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { setMuted } from '@/feedback/feedback';
import {
  type Profile,
  FRESH_PROFILE,
  loadProfile,
  resetProfile,
} from '@/storage/profile';
import {
  type Settings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/storage/settings';
import { PaperButton } from '@/ui/PaperButton';
import { Tally } from '@/ui/Tally';

/**
 * The office: the record so far, what the judge is, and what it cannot do.
 *
 * The limitations are stated here rather than only in the README, because a
 * player deserves to know that a machine is ruling on them and roughly how
 * well it does it.
 */
export default function About() {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(FRESH_PROFILE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadProfile().then((stored) => {
      if (alive) setProfile(stored);
    });
    void loadSettings().then((stored) => {
      if (alive) setSettings(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleSound = useCallback(() => {
    setSettings((current) => {
      const next: Settings = { ...current, muted: !current.muted };
      // The module is told first so the very next sound obeys, then the
      // preference is written. A failed write costs the setting, not the round.
      setMuted(next.muted);
      void saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    void resetProfile().then((fresh) => {
      setProfile(fresh);
      setConfirming(false);
    });
  }, []);

  const admittedShare =
    profile.roundsPlayed === 0
      ? '—'
      : `${Math.round((profile.roundsAdmitted / profile.roundsPlayed) * 100)}%`;

  return (
    <SafeAreaView style={styles.paper}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <Text style={styles.heading} accessibilityRole="header">
          The office
        </Text>

        <Tally
          entries={[
            {
              label: 'total',
              value: String(profile.totalPoints),
              accessibilityLabel: `${profile.totalPoints} points in total`,
            },
            {
              label: 'best streak',
              value: String(profile.bestStreak),
              accessibilityLabel: `Best streak, ${profile.bestStreak}`,
            },
            {
              label: 'admitted',
              value: admittedShare,
              accessibilityLabel:
                profile.roundsPlayed === 0
                  ? 'No rounds played yet'
                  : `${admittedShare} of ${profile.roundsPlayed} submissions admitted`,
            },
          ]}
        />

        <View style={styles.rule} />

        <Text style={styles.body}>
          Rulings are made by a vision model, not by a person. It is quick and it is often
          funny, and at the margins it is inconsistent. Where it cannot decide, it is
          instructed to find for you.
        </Text>

        <Text style={styles.body}>
          Your photograph is sent to the judge, ruled on, and discarded. It is never
          stored, never logged, and no one else sees it. Nothing else about you is
          collected, and there is no account.
        </Text>

        <Text style={styles.body}>
          A photograph of a screen will sometimes be caught and sometimes not. The office
          is aware of this and has decided not to pursue it.
        </Text>

        <View style={styles.rule} />

        <Text style={styles.body}>
          The office makes two noises: the shutter, and the stamp. It respects the silent
          switch, so a phone set to silent stays silent whatever this says.
        </Text>
        <PaperButton
          label={settings.muted ? 'Restore the noise' : 'Silence the office'}
          hint={
            settings.muted
              ? 'Turns the shutter and stamp sounds back on.'
              : 'Turns off the shutter and stamp sounds.'
          }
          onPress={toggleSound}
        />

        <View style={styles.rule} />

        {confirming ? (
          <>
            <Text style={styles.body}>
              The file will be emptied: every point, every streak, the lot. It cannot be
              recovered.
            </Text>
            <PaperButton label="Empty the file" onPress={reset} />
            <PaperButton
              label="Leave it alone"
              onPress={() => {
                setConfirming(false);
              }}
            />
          </>
        ) : (
          <PaperButton
            label="Destroy the record"
            hint="Asks you to confirm before clearing your score and streak."
            onPress={() => {
              setConfirming(true);
            }}
          />
        )}

        <PaperButton
          label="Back to the hunt"
          onPress={() => {
            router.back();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    paper: { flex: 1, backgroundColor: colour.buff },
    sheet: {
      padding: space.roomy,
      paddingBottom: space.vast,
      gap: space.base,
      alignItems: 'flex-start',
    },
    heading: { ...type.ruling, color: colour.ink },
    body: { ...type.body, color: colour.bleed },
    rule: { height: stroke.rule, alignSelf: 'stretch', backgroundColor: colour.padTeal },
  });
