import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Link, Redirect } from 'expo-router';

import { prepareForJudge, type PreparedImage } from '@/capture/downscale';
import { permissionStage } from '@/capture/permission';
import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { useRound } from '@/game/useRound';
import { copyForFailure } from '@/judge/copy';
import { PaperButton } from '@/ui/PaperButton';
import { PaperScreen } from '@/ui/PaperScreen';
import { PromptBand } from '@/ui/PromptBand';
import { Ruling } from '@/ui/Ruling';
import { Shutter } from '@/ui/Shutter';
import { Tally } from '@/ui/Tally';

function caseNumber(points: number, roundsPlayed: number): string {
  return `NO. ${String((roundsPlayed * 37 + points) % 1_000_000).padStart(6, '0')}`;
}

export default function Round() {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const insets = useSafeAreaInsets();
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const takePhoto = useCallback(async (): Promise<PreparedImage | null> => {
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

  if (permissionStage(permission) !== 'granted') {
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

  if (state.kind === 'verdict') {
    return (
      <SafeAreaView style={styles.paper}>
        <ScrollView contentContainerStyle={styles.rulingSheet}>
          <Ruling
            verdict={state.verdict}
            imageUri={state.uri}
            caseNumber={caseNumber(state.points, profile.roundsPlayed)}
          />
          <Tally
            entries={[
              {
                label: 'awarded',
                value: String(state.points),
                accessibilityLabel: `${state.points} points awarded this round`,
              },
              {
                label: 'streak',
                value: String(state.streakAfter),
                accessibilityLabel:
                  state.streakAfter === 0
                    ? 'Streak broken'
                    : `Streak of ${state.streakAfter}`,
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (state.kind === 'captured' || state.kind === 'judging') {
    return (
      <SafeAreaView style={styles.paper}>
        <View style={styles.working}>
          <Image
            source={{ uri: state.uri }}
            style={styles.developing}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel="Your photograph, developing"
          />
          <Text style={styles.workingNote} accessibilityLiveRegion="polite">
            The judge is looking.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        // The preview is decoration for VoiceOver; the prompt, timer and
        // shutter carry everything a non-sighted player acts on.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
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
          <Shutter onPress={round.submit} busy={round.submitting} />
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
    working: {
      flex: 1,
      justifyContent: 'center',
      padding: space.roomy,
      gap: space.roomy,
    },
    // Phase 4 brings this up to full contrast as the ruling arrives.
    developing: {
      width: '100%',
      aspectRatio: 1,
      opacity: 0.45,
      borderWidth: stroke.rule,
      borderColor: colour.bleed,
    },
    workingNote: { ...type.body, color: colour.bleed, textAlign: 'center' },
    aside: { alignSelf: 'flex-start' },
    asideText: { ...type.label, color: colour.bleed },
  });
