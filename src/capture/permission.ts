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
