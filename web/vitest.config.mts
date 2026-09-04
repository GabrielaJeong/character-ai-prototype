import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 프론트 테스트 설정.
 *
 * 범위: 렌더링 테스트가 아니라 **로직 단위**만 — 어드민 게이트(middleware),
 * zustand store, SSE 파서. 컴포넌트 렌더 테스트는 RTL 도입 시 별도 확장.
 * environment는 node — 대상이 전부 DOM 비의존이라 jsdom 부팅 비용을 안 낸다.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir, // tsconfig paths "@/*": ["./*"] 와 일치
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    restoreMocks: true,
  },
});
