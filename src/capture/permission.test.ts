import { needsSettingsTrip, permissionStage } from './permission';

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
