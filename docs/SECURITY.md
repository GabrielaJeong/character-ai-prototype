# Folio 보안 정책

> 적용된 방어 기법 및 알려진 제한사항.
> 포트폴리오 프로토타입 기준 (프로덕션 강화 항목은 하단 참조).

---

## 적용된 방어 기법

### SQL Injection
- 모든 쿼리는 `stmt` 객체의 prepared statement 사용 (CONVENTIONS.md §3)
- 동적 쿼리 불가피한 경우 `db/index.js` 헬퍼 함수로 격리 (D-011)
- 라우터에서 `db.prepare()` 직접 호출 금지

### XSS (Cross-Site Scripting)
- 유저 입력값 `innerHTML` 렌더링 시 `escapeHtml()` 적용
  - 채팅 메시지, 세션 미리보기, 닉네임, 아이디, 이메일
  - 유저 생성 캐릭터 이름·역할·태그
  - 크리에이터 프로필 닉네임·핸들
  - 정보 수정 모달 input value 속성
- `escapeHtml()`: `&`, `<`, `>`, `"`, `'` 5종 이스케이프
- CSP 헤더 적용 (helmet) — defaultSrc self, scriptSrc unsafe-inline 최소화 예정

### CSRF
- `express-session` `sameSite: 'lax'` 설정
- `httpOnly: true` 쿠키 플래그
- `secure: true` (production 환경)

### Rate Limiting
- 인증 엔드포인트 (`/api/auth/login`, `/api/auth/register`): 15분당 10회
- 아이디 중복 확인 (`/api/auth/check-username`): 15분당 30회 (실시간 타이핑 고려)
- 일반 API (`/api/*`): 15분당 200회

### 파일 업로드 (어드민 전용)
- 확장자 화이트리스트: jpg, jpeg, png, webp, gif
- 파일 크기 5MB 제한 (base64 7MB 문자열 길이 기준)
- 파일명 자동 생성 (`bc_timestamp_random.ext`) — path traversal 방지
- 어드민 권한 필수 (`requireAdmin` 가드)

### 인증
- 비밀번호 `bcryptjs` 해싱
- 세션 기반 인증 (`express-session` + SQLite 세션 스토어)
- 역할 체크: `user.role === 'admin'` 기준 (username 하드코딩 금지)

### 정보 노출 방지
- `public_id` (UUID v4) 사용 — 내부 DB `id` 미노출
- production 환경 스택 트레이스 숨김 (글로벌 에러 핸들러)
- 세션 secret fallback은 dev only, 경고 로그 출력

---

## 알려진 제한사항 (프로토타입 단계)

| 항목 | 상태 | 비고 |
|------|------|------|
| 소셜 로그인 | 미구현 | MVP 범위 외 |
| 2FA | 미구현 | 프로토타입 제외 |
| Sentry 에러 로깅 | 미연동 | 프로덕션 단계 예정 |
| CSRF 토큰 | SameSite=lax로 대체 | csurf deprecated |
| 이미지 MIME 타입 검증 | 확장자만 체크 | magic bytes 검사 미적용 |
| Rate limit 스토어 | 인메모리 | 재시작 시 초기화, 분산 환경 미지원 |

---

## 보안 테스트

`tests/api/security.test.js`:
- helmet 헤더 검증 (X-Content-Type-Options, X-Frame-Options, CSP)
- 로그인 rate limit 429 검증
- session cookie httpOnly 플래그 검증
