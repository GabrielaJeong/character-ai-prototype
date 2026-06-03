// ESLint flat config (v9+). 루트 Node.js 백엔드 전용.
//   - public/ : 폐기 예정 SPA (브라우저 전역 스크립트, 별도 기준) → ignore
//   - web/    : Next.js 프론트, 자체 `next lint` 사용 → ignore
// 기존 eslintrc.json(파일명 오타로 미작동)을 대체.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/',
      'public/',
      'web/',
      'db/chat.db*',
      'data/',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',  // catch (_) {} 패턴 허용
      }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'multi-line'],
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'no-empty': ['error', { allowEmptyCatch: true }],  // 빈 catch는 의도적 무시 허용
      'no-useless-escape': 'off',          // 정규식 가독성 위한 명시적 이스케이프 허용
      'no-useless-assignment': 'off',      // v10 신규 — 기존 코드에 과도
    },
  },
  {
    // Jest 테스트 — describe/it/expect 등 전역
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
