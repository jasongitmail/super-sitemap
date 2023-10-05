module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:svelte/recommended',
    'prettier',
    'plugin:perfectionist/recommended-natural'
  ],
  overrides: [
    {
      parserOptions: {
        parser: '@typescript-eslint/parser'
      },
      parser: 'svelte-eslint-parser',
      files: ['*.svelte']
    }
  ],
  parserOptions: {
    extraFileExtensions: ['.svelte'],
    sourceType: 'module',
    ecmaVersion: 2020
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true
};
