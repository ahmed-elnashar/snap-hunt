import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { fontAssets } from '@/design/fonts';
import { colour, space, type } from '@/design/tokens';

void SplashScreen.preventAutoHideAsync();

// The root is buff so there is never a white frame between splash and paper.
void SystemUI.setBackgroundColorAsync(colour.buff);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (fontError !== null) {
    return (
      <View style={styles.fallback} accessibilityRole="alert">
        <StatusBar style="dark" />
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
      <StatusBar style="dark" />
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

const styles = StyleSheet.create({
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
