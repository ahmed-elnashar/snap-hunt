import { needsSettingsTrip, permissionStage, roundGate } from './permission';

describe('permissionStage', () => {
  it('is unknown before the OS has answered', () => {
    expect(permissionStage(null)).toBe('unknown');
  });

  it('is granted when the camera is available', () => {
    expect(permissionStage({ granted: true, canAskAgain: false })).toBe('granted');
  });

  it('prefers granted over canAskAgain, which iOS reports as false once granted', () => {
    expect(permissionStage({ granted: true, canAskAgain: false })).toBe('granted');
    expect(permissionStage({ granted: true, canAskAgain: true })).toBe('granted');
  });

  it('asks when permission is absent but still requestable', () => {
    expect(permissionStage({ granted: false, canAskAgain: true })).toBe('ask');
  });

  it('is blocked when refused and no longer requestable', () => {
    expect(permissionStage({ granted: false, canAskAgain: false })).toBe('blocked');
  });
});

describe('needsSettingsTrip', () => {
  it('is true only when blocked, so a first refusal still offers a retry', () => {
    expect(needsSettingsTrip({ granted: false, canAskAgain: false })).toBe(true);
    expect(needsSettingsTrip({ granted: false, canAskAgain: true })).toBe(false);
    expect(needsSettingsTrip({ granted: true, canAskAgain: false })).toBe(false);
    expect(needsSettingsTrip(null)).toBe(false);
  });
});

describe('roundGate', () => {
  const granted = { granted: true, canAskAgain: false };
  const askable = { granted: false, canAskAgain: true };
  const blocked = { granted: false, canAskAgain: false };

  it('waits rather than redirecting while the OS has not answered', () => {
    // The regression. useCameraPermissions starts at null on every mount, so
    // redirecting here sent the player to onboarding, which granted, redirected
    // back, and mounted a fresh null. The app never settled on either screen.
    expect(roundGate(null, false)).toBe('wait');
  });

  it('plays once the camera is granted', () => {
    expect(roundGate(granted, false)).toBe('play');
  });

  it('sends a genuine refusal to onboarding, both kinds', () => {
    expect(roundGate(askable, false)).toBe('onboard');
    expect(roundGate(blocked, false)).toBe('onboard');
  });

  it('never leaves the round screen under the harness, which has no camera', () => {
    for (const permission of [null, granted, askable, blocked]) {
      expect(roundGate(permission, true)).toBe('play');
    }
  });

  it('only ever redirects on a permission the OS has actually reported', () => {
    // Stated as a property: 'onboard' requires a non-null answer. This is the
    // invariant the loop violated, independent of how the branches are written.
    for (const permission of [null, granted, askable, blocked]) {
      if (roundGate(permission, false) === 'onboard') {
        expect(permission).not.toBeNull();
      }
    }
  });
});
