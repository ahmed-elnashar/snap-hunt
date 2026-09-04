/**
 * Reanimated under Jest.
 *
 * The library's own `react-native-reanimated/mock` re-enters the real package,
 * which loads `react-native-worklets` and dies on a missing native module —
 * jest-expo deliberately does not transform the worklets plugin. So this mocks
 * only the surface the app actually uses.
 *
 * Animations resolve immediately to their target. Tests therefore see the
 * finished composition, which is also exactly what a player with reduce-motion
 * enabled sees, so the assertions are about the state that matters either way.
 */
const React = require('react');
const { View, Text, Image, ScrollView } = require('react-native');

const identity = (value) => value;

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  __esModule: true,
  default: Animated,

  useSharedValue: (initial) => React.useRef({ value: initial }).current,
  useAnimatedStyle: (factory) => factory(),
  useDerivedValue: (factory) => ({ value: factory() }),
  useAnimatedRef: () => React.useRef(null),

  withTiming: identity,
  withSpring: identity,
  withDelay: (_delay, animation) => animation,
  withSequence: (...animations) => animations[animations.length - 1],
  withRepeat: identity,
  cancelAnimation: () => undefined,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,

  /**
   * False by default. A test that needs the reduce-motion branch overrides this
   * with jest.spyOn, so the default stays the ordinary path.
   */
  useReducedMotion: () => false,

  Easing: {
    linear: identity,
    ease: identity,
    quad: identity,
    cubic: identity,
    bezier: () => identity,
    in: identity,
    out: identity,
    inOut: identity,
  },

  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
};
