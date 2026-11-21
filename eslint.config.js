import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', '.gmp_cache/**/*', '.playwright-cli/**/*', 'node_modules/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
