// @testing-library/react-native v13 registers its matchers automatically.

// Reanimated ships a test shim; without it every animated component throws.
// jest.mock factories are hoisted above imports, so this must stay a require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
