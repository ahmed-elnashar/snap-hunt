import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect } from 'expo-router';

import { permissionStage } from '@/capture/permission';
import { prepareForJudge, type PreparedImage } from '@/capture/downscale';
import { space, stroke, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';
import { PaperButton } from '@/ui/PaperButton';
import { PaperScreen } from '@/ui/PaperScreen';
import { PromptBand } from '@/ui/PromptBand';
import { Shutter } from '@/ui/Shutter';

/**
 * Phase 1: framing and capture. The prompt is fixed until Phase 3 brings the
 * pack and the clock, and nothing is judged until Phase 2.
 */
const PLACEHOLDER_PROMPT = 'something round and blue';

export default function Round() {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const insets = useSafeAreaInsets();
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<PreparedImage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (camera.current === null) return;
    setBusy(true);
    setFailure(null);
    try {
      // No skipProcessing: it returns the sensor's own orientation, and a photo
      // handed to the judge sideways is a different photo.
      const photo = await camera.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });
      if (photo === undefined) {
        setFailure('The shutter closed on nothing.');
        return;
      }
      setSubmitted(await prepareForJudge(photo));
    } catch {
      setFailure('The photograph did not survive being handled.');
    } finally {
      setBusy(false);
    }
  }, []);

  if (permissionStage(permission) !== 'granted') {
    return <Redirect href="/onboarding" />;
  }

  if (failure !== null) {
    return (
      <PaperScreen
        announce
        ruling={failure}
        note="Nothing has been ruled on. Take it again."
      >
        <PaperButton
          label="Take it again"
          onPress={() => {
            setFailure(null);
          }}
        />
      </PaperScreen>
    );
  }

  if (submitted !== null) {
    return (
      <PaperScreen
        ruling="Received. Nothing has been ruled on yet."
        note="The judge is not yet sitting. It takes its seat in the next phase of the build."
      >
        <Image
          source={{ uri: submitted.uri }}
          style={styles.print}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel="The photograph you submitted"
        />
        <Text style={styles.readout}>
          {submitted.width} × {submitted.height}
        </Text>
        <PaperButton
          label="Submit another"
          onPress={() => {
            setSubmitted(null);
          }}
        />
      </PaperScreen>
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
        <PromptBand prompt={PLACEHOLDER_PROMPT} topInset={insets.top} />
        <View
          style={[styles.shutterBand, { paddingBottom: insets.bottom + space.roomy }]}
        >
          <Shutter onPress={() => void capture()} busy={busy} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colour.buff },
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
    print: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderWidth: stroke.rule,
      borderColor: colour.bleed,
    },
    readout: { ...type.caseNumber, color: colour.bleed },
  });
