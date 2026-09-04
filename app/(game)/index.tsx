import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Link, Redirect } from 'expo-router';

import { prepareForJudge, type PreparedImage } from '@/capture/downscale';
import { e2ePhoto, isE2E } from '@/capture/e2e';
import { permissionStage } from '@/capture/permission';
import { space, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { play } from '@/feedback/feedback';
import { hashString } from '@/game/prompts';
import { useRound } from '@/game/useRound';
import { copyForFailure } from '@/judge/copy';
import { PaperButton } from '@/ui/PaperButton';
import { PaperScreen } from '@/ui/PaperScreen';
import { PromptBand } from '@/ui/PromptBand';
import { Ruling } from '@/ui/Ruling';
import { Shutter } from '@/ui/Shutter';
import { Tally } from '@/ui/Tally';

/** Stable across the develop and the ruling, because both inputs are. */
function caseNumber(promptId: string, roundsPlayed: number): string {
  const n = hashString(`${promptId}:${roundsPlayed}`) % 1_000_000;
  return `NO. ${String(n).padStart(6, '0')}`;
}

export default function Round() {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const insets = useSafeAreaInsets();
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const takePhoto = useCallback(async (): Promise<PreparedImage | null> => {
    if (isE2E()) return e2ePhoto();
    if (camera.current === null) return null;
    // No skipProcessing: it returns the sensor's own orientation, and a
    // photograph handed to the judge sideways is a different photograph.
    const photo = await camera.current.takePictureAsync({
      quality: 0.8,
      base64: false,
      exif: false,
    });
    return photo === undefined ? null : prepareForJudge(photo);
  }, []);

  const round = useRound({ takePhoto });
  const { state, profile, loaded, startRound } = round;

  // Deal the first round as soon as the record is known, because the untimed
  // round zero depends on whether this player has played before.
  useEffect(() => {
    if (loaded && state.kind === 'idle') startRound();
  }, [loaded, state.kind, startRound]);

  const submit = useCallback(() => {
    play('shutter');
    round.submit();
  }, [round]);

  // The harness never asks for a camera it cannot use.
  if (!isE2E() && permissionStage(permission) !== 'granted') {
    return <Redirect href="/onboarding" />;
  }

  if (!loaded || state.kind === 'idle') {
    return <View style={styles.paper} />;
  }

  if (state.kind === 'expired') {
    return (
      <PaperScreen
        announce
        ruling="Time. The submission was not made."
        note="No ruling, and nothing against you. Your streak is intact."
      >
        <PaperButton label="Take the next one" onPress={round.startRound} />
      </PaperScreen>
    );
  }

  if (state.kind === 'failed') {
    const copy = copyForFailure(state.reason);
    return (
      <PaperScreen announce ruling={copy.ruling} note={copy.note}>
        <PaperButton label={copy.action} onPress={round.retry} />
        <PaperButton label="Take a different one" onPress={round.startRound} />
      </PaperScreen>
    );
  }

  /**
   * Developing and ruled are one screen, not two. The print must not unmount
   * and remount between them or the develop restarts under the stamp.
   */
  if (state.kind === 'captured' || state.kind === 'judging' || state.kind === 'verdict') {
    const ruled = state.kind === 'verdict' ? state : null;
    return (
      <SafeAreaView style={styles.paper}>
        <ScrollView contentContainerStyle={styles.rulingSheet}>
          <Ruling
            verdict={ruled === null ? null : ruled.verdict}
            imageUri={state.uri}
            caseNumber={caseNumber(state.prompt.id, profile.roundsPlayed)}
          />

          {ruled !== null && (
            <>
              <Tally
                entries={[
                  {
                    label: 'awarded',
                    value: String(ruled.points),
                    accessibilityLabel: `${ruled.points} points awarded this round`,
                  },
                  {
                    label: 'streak',
                    value: String(ruled.streakAfter),
                    accessibilityLabel:
                      ruled.streakAfter === 0
                        ? 'Streak broken'
                        : `Streak of ${ruled.streakAfter}`,
                  },
                  {
                    label: 'total',
                    value: String(profile.totalPoints),
                    accessibilityLabel: `${profile.totalPoints} points in total`,
                  },
                ]}
              />
              <PaperButton label="Next submission" onPress={round.startRound} />
              <Link href="/about" style={styles.aside}>
                <Text style={styles.asideText}>The office</Text>
              </Link>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {/* The simulator has no camera, so the harness shows the submission it
          is about to hand in rather than a black rectangle. */}
      {isE2E() ? (
        <Image
          source={require('@/assets/e2e/submission.jpg')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          // The preview is decoration for VoiceOver; the prompt, timer and
          // shutter carry everything a non-sighted player acts on.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <SafeAreaView style={styles.chrome} edges={[]} pointerEvents="box-none">
        <PromptBand
          prompt={state.prompt.text}
          topInset={insets.top}
          remainingMs={round.remaining}
          isDaily={round.isDaily}
        />
        <View
          style={[styles.shutterBand, { paddingBottom: insets.bottom + space.roomy }]}
        >
          <Shutter onPress={submit} busy={round.submitting} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colour.buff },
    paper: { flex: 1, backgroundColor: colour.buff },
    // The bands sit on the preview; the preview runs full-bleed behind them.
    chrome: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'space-between',
    },
    shutterBand: {
      backgroundColor: colour.buff,
      alignItems: 'center',
      paddingTop: space.roomy,
    },
    rulingSheet: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: space.roomy,
      gap: space.roomy,
    },
    aside: { alignSelf: 'flex-start' },
    asideText: { ...type.label, color: colour.bleed },
  });
