/**
 * Which of the four camera screens the player should be looking at.
 *
 * Pure, so the branch that decides whether someone hits a dead end is unit
 * tested rather than only reachable by revoking a permission on a real phone.
 */

export type PermissionStage =
  /** The OS has not told us yet. Show nothing rather than a wrong screen. */
  | 'unknown'
  /** We may still ask. Show the priming screen, then request. */
  | 'ask'
  /** Granted. Show the camera. */
  | 'granted'
  /** Refused and the OS will not ask again. Only Settings can undo this. */
  | 'blocked';

export type PermissionLike = {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
};

export function permissionStage(permission: PermissionLike | null): PermissionStage {
  if (permission === null) return 'unknown';
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'ask' : 'blocked';
}

/**
 * True when the only route back is the Settings app. The recovery screen offers
 * a deep link in this case and a retry in the other; getting this backwards is
 * how a camera app turns a denial into a dead end.
 */
export function needsSettingsTrip(permission: PermissionLike | null): boolean {
  return permissionStage(permission) === 'blocked';
}

/**
 * How long the round screen sits on an unanswered permission before it stops
 * being a blank sheet and says something.
 *
 * expo's usePermission calls its getter with no catch, so a rejected or
 * never-settling query leaves the status at null for good. Generous enough
 * that nobody healthy ever sees it.
 */
export const PERMISSION_STALL_MS = 5_000;

export type RoundGate =
  /** The OS has not answered this component yet. Hold the paper, do not move. */
  | 'wait'
  /** Genuinely not granted. Send the player to the one screen that can fix it. */
  | 'onboard'
  /** Show the camera. */
  | 'play';

/**
 * What the round screen should do about a permission it may not know yet.
 *
 * `useCameraPermissions` holds its own state per component and starts at `null`
 * on every mount, resolving in an effect. So `unknown` means "has not answered
 * yet", never "refused" — and treating the two the same is a dead end rather
 * than a slow screen:
 *
 *   round mounts -> null -> redirect to onboarding -> onboarding's own hook
 *   resolves to granted -> redirect to round -> round mounts with a fresh null
 *
 * which never settles. Waiting one render is the whole fix. Pure so the loop is
 * covered by a test rather than by remembering.
 */
export function roundGate(permission: PermissionLike | null, e2e: boolean): RoundGate {
  // The harness never asks for a camera the simulator does not have.
  if (e2e) return 'play';
  switch (permissionStage(permission)) {
    case 'unknown':
      return 'wait';
    case 'granted':
      return 'play';
    case 'ask':
    case 'blocked':
      return 'onboard';
  }
}
