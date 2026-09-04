import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

import { fontAssets } from '@/design/fonts';
import { configureFeedback, setMuted } from '@/feedback/feedback';
import { loadSettings } from '@/storage/settings';
import { space, type, type Palette } from '@/design/tokens';
import { useColours } from '@/design/useColours';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colour = useColours();
  const styles = useMemo(() => makeStyles(colour), [colour]);
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Keeps the window behind the navigator on the current stock, so switching
  // schemes never flashes a colour that is in neither palette.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colour.buff);
  }, [colour.buff]);

  // The audio session is configured once, before anything can ask for a sound.
  // No sound is played on open; this only makes the two that exist possible.
  useEffect(() => {
    void configureFeedback();
    void loadSettings().then((settings) => setMuted(settings.muted));
  }, []);

  if (!ready) return null;

  if (fontError !== null) {
    return (
      <View style={styles.fallback} accessibilityRole="alert">
        <StatusBar style="auto" />
        <Text style={styles.fallbackRuling}>
          The office typewriter has failed to arrive.
        </Text>
        <Text style={styles.fallbackBody}>
          Nothing can be ruled on until it does. Close the application and open it again.
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colour.buff },
          animation: 'fade',
        }}
      />
    </>
  );
}

const makeStyles = (colour: Palette) =>
  StyleSheet.create({
    fallback: {
      flex: 1,
      backgroundColor: colour.buff,
      justifyContent: 'center',
      paddingHorizontal: space.wide,
      gap: space.base,
    },
    fallbackRuling: { ...type.ruling, color: colour.ink },
    fallbackBody: { ...type.body, color: colour.bleed },
  });
