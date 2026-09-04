// @testing-library/react-native v13 registers its matchers automatically.

// Native storage has no implementation under Jest. Mocking it here rather than
// in each test file keeps a whole class of unrelated suites from breaking when
// a module happens to pull storage in transitively.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
