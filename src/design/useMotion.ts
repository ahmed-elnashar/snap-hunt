import { useReducedMotion } from 'react-native-reanimated';

/**
 * Motion, with the reduce-motion setting applied once rather than remembered at
 * every call site.
 *
 * `reduced` is not "animate faster". The app has exactly one orchestrated
 * moment, and with reduce-motion enabled that moment is presented as a composed
 * still — the print already developed, the stamp already landed, still rotated
 * and still off-register, with the haptic still firing. The joke was never in
 * the tween.
 */
export type Motion = {
  readonly reduced: boolean;
  /** A duration, collapsed to zero when motion is reduced. */
  ms: (duration: number) => number;
};

export function useMotion(): Motion {
  const reduced = useReducedMotion();
  return {
    reduced,
    ms: (duration: number) => (reduced ? 0 : duration),
  };
}
