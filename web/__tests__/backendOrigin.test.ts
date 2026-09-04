import { describe, it, expect, afterEach } from 'vitest';
import { resolveBackendOrigin } from '@/next.config.mjs';

/**
 * BACKEND_ORIGIN 정규화.
 *
 * 스킴이 빠진 값이 들어가면 rewrite destination 이 절대 URL도 상대 경로도
 * 아니게 되어 "Error: Invalid rewrites found" 로 **배포 빌드가 통째로 죽는다**.
 * CI에는 이 env가 없어 기본값으로 빌드되므로 절대 재현되지 않고, Vercel에서만
 * 터진다. 그래서 정규화 로직을 여기서 직접 고정한다.
 */

const original = process.env.BACKEND_ORIGIN;
afterEach(() => {
  if (original === undefined) delete process.env.BACKEND_ORIGIN;
  else process.env.BACKEND_ORIGIN = original;
});

function resolve(value?: string) {
  if (value === undefined) delete process.env.BACKEND_ORIGIN;
  else process.env.BACKEND_ORIGIN = value;
  return resolveBackendOrigin();
}

describe('resolveBackendOrigin', () => {
  it('미설정이면 로컬 dev 기본값', () => {
    expect(resolve(undefined)).toBe('http://localhost:3000');
  });

  it('빈 문자열·공백도 기본값으로 떨어진다', () => {
    expect(resolve('')).toBe('http://localhost:3000');
    expect(resolve('   ')).toBe('http://localhost:3000');
  });

  it('스킴이 없으면 https 를 붙인다 — 실제 배포를 깨뜨렸던 케이스', () => {
    expect(resolve('folio-charc.up.railway.app')).toBe('https://folio-charc.up.railway.app');
  });

  it('끝 슬래시를 제거한다 — 안 그러면 //api/... 가 된다', () => {
    expect(resolve('https://folio-charc.up.railway.app/')).toBe(
      'https://folio-charc.up.railway.app',
    );
    expect(resolve('https://folio-charc.up.railway.app///')).toBe(
      'https://folio-charc.up.railway.app',
    );
  });

  it('http 도 그대로 인정한다 (로컬/사설망)', () => {
    expect(resolve('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('앞뒤 공백은 잘라낸다', () => {
    expect(resolve('  https://folio-charc.up.railway.app  ')).toBe(
      'https://folio-charc.up.railway.app',
    );
  });

  it('URL로 해석 불가하면 원인을 밝힌 에러를 던진다', () => {
    expect(() => resolve('https://')).toThrowError(/BACKEND_ORIGIN/);
  });
});
