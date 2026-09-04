import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { Redirect } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';

import { permissionStage } from '@/capture/permission';
import { PaperButton } from '@/ui/PaperButton';
import { PaperScreen } from '@/ui/PaperScreen';

/**
 * Everything to do with the camera permission lives here, so there is exactly
 * one place where a denial can turn into a dead end — and it does not.
 *
 * Priming comes before the OS prompt, because a system dialog with no context
 * is the fastest way to get a refusal. Once refused permanently, the only route
 * back is Settings, and this screen offers it rather than repeating a request
 * iOS will never show again.
 */
export default function Onboarding() {
  const [permission, requestPermission] = useCameraPermissions();
  // A rejected request leaves the permission null forever, which would render
  // the blank sheet below with nothing to press. See the ask() catch.
  const [askFailed, setAskFailed] = useState(false);
  const stage = permissionStage(permission);

  const ask = useCallback(() => {
    setAskFailed(false);
    // No router.replace here: granting updates the hook, which re-renders into
    // the Redirect above. One mechanism for the navigation, not two racing.
    void requestPermission().catch(() => setAskFailed(true));
  }, [requestPermission]);

  if (stage === 'granted') return <Redirect href="/" />;

  if (askFailed) {
    return (
      <PaperScreen
        announce
        ruling="The camera was asked for and the question went unanswered."
        note="Nothing has been decided and nothing is held against you. Ask again; the office keeps the file open."
      >
        <PaperButton
          label="Ask again"
          hint="Requests camera access from iOS a second time."
          onPress={ask}
        />
      </PaperScreen>
    );
  }

  // The OS has not answered yet. A blank sheet is better than a screen that
  // asks for something already granted.
  if (stage === 'unknown') return <PaperScreen ruling="" />;

  if (stage === 'blocked') {
    return (
      <PaperScreen
        announce
        ruling="The camera has been withheld."
        note="Nothing can be submitted until the office is permitted to look. Settings will let you reverse that; the round will be waiting."
      >
        <PaperButton
          label="Open Settings"
          hint="Leaves Snap Hunt and opens its entry in the Settings app."
          onPress={() => {
            void Linking.openSettings();
          }}
        />
      </PaperScreen>
    );
  }

  return (
    <PaperScreen
      ruling="The judge cannot rule on a photograph it has not been shown."
      note="The camera is used for one thing: the picture you hand in. It is sent to the judge, ruled on, and discarded. It is never stored, and no one else sees it."
    >
      <PaperButton
        label="Hand over the camera"
        hint="Asks iOS for camera access."
        onPress={ask}
      />
    </PaperScreen>
  );
}
