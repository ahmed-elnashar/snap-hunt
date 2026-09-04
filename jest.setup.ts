// @testing-library/react-native v13 registers its matchers automatically.

// Reanimated ships a test shim; without it every animated component throws.
// jest.mock factories are hoisted above imports, so this must stay a require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Native storage has no implementation under Jest. Mocking it here rather than
// in each test file keeps a whole class of unrelated suites from breaking when
// a module happens to pull storage in transitively.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
