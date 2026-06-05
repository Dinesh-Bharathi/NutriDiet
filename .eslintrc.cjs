module.exports = {
  env: { node: true, es2024: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended'],
  rules: {
    'no-console': 'error',
    'eqeqeq': ['error', 'always'],
    'prefer-const': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-var': 'error'
  }
};
