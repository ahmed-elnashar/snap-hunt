import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect } from 'expo-router';

import { prepareForJudge, type PreparedImage } from '@/capture/downscale';
import { permissionStage } from '@/capture/permission';
import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { askTheJudge, type JudgeFailure } from '@/judge/client';
import { copyForFailure } from '@/judge/copy';
import { type Verdict } from '@/judge/schema';
import { getDeviceId } from '@/storage/deviceId';
import { PaperButton } from '@/ui/PaperButton';
import { PaperScreen } from '@/ui/PaperScreen';
import { PromptBand } from '@/ui/PromptBand';
import { Ruling } from '@/ui/Ruling';
import { Shutter } from '@/ui/Shutter';

/**
 * Phase 2: a photograph goes to the judge and a ruling comes back. The prompt
 * is fixed and there is no clock until Phase 3, and the stamp does not yet land
 * — Phase 4 animates it. The composition on screen is already the resting state.
 */
const PLACEHOLDER_PROMPT = { id: 'round-blue-01', text: 'something round and blue' };

type Screen =
  | { readonly kind: 'framing' }
  | { readonly kind: 'working'; readonly image: PreparedImage | null }
  | {
      readonly kind: 'ruled';
      readonly image: PreparedImage;
      readonly verdict: Verdict;
      readonly caseNumber: string;
    }
  | {
      readonly kind: 'failed';
      readonly reason: JudgeFailure;
      readonly retryAfterSeconds?: number;
    };

function formatCaseNumber(n: number): string {
  return `NO. ${String(n % 1_000_000).padStart(6, '0')}`;
}

export default function Round() {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const insets = useSafeAreaInsets();
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const caseSeq = useRef(411);

  const [screen, setScreen] = useState<Screen>({ kind: 'framing' });

  const submit = useCallback(async () => {
    if (camera.current === null) return;
    setScreen({ kind: 'working', image: null });

    let image: PreparedImage;
    try {
      // No skipProcessing: it returns the sensor's own orientation, and a
      // photograph handed to the judge sideways is a different photograph.
      const photo = await camera.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });
      if (photo === undefined) {
        setScreen({ kind: 'failed', reason: 'unparseable' });
        return;
      }
      image = await prepareForJudge(photo);
    } catch {
      setScreen({ kind: 'failed', reason: 'unparseable' });
      return;
    }

    setScreen({ kind: 'working', image });

    const result = await askTheJudge({
      promptId: PLACEHOLDER_PROMPT.id,
      promptText: PLACEHOLDER_PROMPT.text,
      imageBase64: image.base64,
      deviceId: await getDeviceId(),
    });

    if (result.kind === 'failed') {
      caseSeq.current += 1;
      setScreen(
        result.retryAfterSeconds === undefined
          ? { kind: 'failed', reason: result.reason }
          : {
              kind: 'failed',
              reason: result.reason,
              retryAfterSeconds: result.retryAfterSeconds,
            },
      );
      return;
    }

    caseSeq.current += 1;
    setScreen({
      kind: 'ruled',
      image,
      verdict: result.verdict,
      caseNumber: formatCaseNumber(caseSeq.current),
    });
  }, []);

  const reframe = useCallback(() => setScreen({ kind: 'framing' }), []);

  if (permissionStage(permission) !== 'granted') {
    return <Redirect href="/onboarding" />;
  }

  if (screen.kind === 'failed') {
    const copy = copyForFailure(screen.reason, screen.retryAfterSeconds);
    return (
      <PaperScreen announce ruling={copy.ruling} note={copy.note}>
        <PaperButton label={copy.action} onPress={reframe} />
      </PaperScreen>
    );
  }

  if (screen.kind === 'ruled') {
    return (
      <SafeAreaView style={styles.paper}>
        <ScrollView contentContainerStyle={styles.rulingSheet}>
          <Ruling
            verdict={screen.verdict}
            imageUri={screen.image.uri}
            caseNumber={screen.caseNumber}
          />
          <PaperButton label="Next submission" onPress={reframe} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen.kind === 'working') {
    return (
      <SafeAreaView style={styles.paper}>
        <View style={styles.working}>
          {screen.image !== null && (
            <Image
              source={{ uri: screen.image.uri }}
              style={styles.developing}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              accessibilityLabel="Your photograph, developing"
            />
          )}
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
        // The preview is decoration for VoiceOver; the prompt and the shutter
        // carry everything a non-sighted player acts on.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <SafeAreaView style={styles.chrome} edges={[]} pointerEvents="box-none">
        <PromptBand prompt={PLACEHOLDER_PROMPT.text} topInset={insets.top} />
        <View
          style={[styles.shutterBand, { paddingBottom: insets.bottom + space.roomy }]}
        >
          <Shutter onPress={() => void submit()} />
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
      gap: space.wide,
    },
    working: {
      flex: 1,
      justifyContent: 'center',
      padding: space.roomy,
      gap: space.roomy,
    },
    // Phase 4 brings this up to full contrast over the judge's round trip.
    developing: {
      width: '100%',
      aspectRatio: 1,
      opacity: 0.45,
      borderWidth: stroke.rule,
      borderColor: colour.bleed,
    },
    workingNote: { ...type.body, color: colour.bleed, textAlign: 'center' },
  });
