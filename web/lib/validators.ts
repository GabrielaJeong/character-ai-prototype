/**
 * 클라이언트 측 폼 검증 헬퍼.
 *
 * 백엔드 routes/auth.js의 Joi 스키마와 메시지 동일하게 유지 (UX 일관성).
 * 진짜 검증은 서버에서 — 클라이언트는 즉시 피드백용.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
const NICKNAME_REGEX = /^[^\s!@#$%^&*()+=\[\]{};':"\\|,.<>/?`~]+$/;
const USERNAME_REGEX = /^[a-z0-9_]+$/;

export function validateEmail(v: string): string | null {
  if (!v.trim()) return '이메일을 입력해주세요';
  if (!EMAIL_REGEX.test(v.trim())) return '이메일 형식이 올바르지 않습니다';
  return null;
}

export function validatePassword(v: string): string | null {
  if (!v) return '비밀번호를 입력해주세요';
  if (!PASSWORD_REGEX.test(v)) return '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다';
  return null;
}

export function validateNickname(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return '닉네임을 입력해주세요';
  if (trimmed.length < 2 || trimmed.length > 12) return '닉네임은 2~12자, 특수문자 없이 입력해주세요';
  if (!NICKNAME_REGEX.test(trimmed)) return '닉네임은 2~12자, 특수문자 없이 입력해주세요';
  return null;
}

export function validateUsername(v: string): string | null {
  const lower = v.toLowerCase();
  if (!lower) return '@아이디를 입력해주세요';
  if (lower.length < 3 || lower.length > 20) return '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다';
  if (!USERNAME_REGEX.test(lower)) return '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다';
  return null;
}

/**
 * URL `redirect` 파라미터 검증.
 * Open redirect 방지 — `/` 로 시작하지 않으면 거부.
 * 원본 SPA의 _routePersonaLinked + submitLogin 패턴 (L-011 참조).
 */
export function safeRedirect(redirect: string | null): string {
  if (!redirect) return '/';
  if (!redirect.startsWith('/')) return '/';
  if (redirect.startsWith('//')) return '/';   // protocol-relative URL 차단
  return redirect;
}
