// @ts-check
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const tseslint = require('@typescript-eslint/eslint-plugin');

/**
 * A hex colour literal outside src/design/tokens.ts fails the build.
 * This is the mechanical half of the design constraint; the human half is that
 * a value not in tokens.ts is a design decision, not an inline detail.
 */
const HEX = String.raw`#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})`;
const HEX_MESSAGE =
  'No hex colour outside src/design/tokens.ts. Use a token, or add one and say why in DESIGN.md.';

const noHexLiterals = {
  selector: `Literal[value=/^${HEX}$/]`,
  message: HEX_MESSAGE,
};

const noHexInTemplates = {
  selector: `TemplateElement[value.raw=/${HEX}\\b/]`,
  message: HEX_MESSAGE,
};

module.exports = [
  ...expoConfig,
  prettier,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'expo-env.d.ts'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    rules: {
      'no-restricted-syntax': ['error', noHexLiterals, noHexInTemplates],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  {
    // The one file allowed to name a colour.
    files: ['src/design/tokens.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Tests assert on malformed shapes; scripts report to the console.
    files: ['**/*.test.ts', '**/*.test.tsx', 'scripts/**'],
    rules: { 'no-console': 'off', 'no-restricted-syntax': 'off' },
  },
];
