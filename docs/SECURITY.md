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
- CSP 헤더 적용 (helmet)

| 디렉티브 | 허용 출처 | 이유 |
|---------|----------|------|
| `script-src` | `'self'`, `'unsafe-inline'`, `cdn.jsdelivr.net` | Chart.js (어드민 대시보드) |
| `script-src-attr` | `'unsafe-inline'` | app.js 인라인 onclick 핸들러 (helmet 기본값 `'none'` 명시 재정의) |
| `style-src` | `'self'`, `'unsafe-inline'`, `cdn.jsdelivr.net` | Pretendard CSS @import |
| `font-src` | `'self'`, `data:`, `cdn.jsdelivr.net` | Pretendard 웹폰트 파일 |
| `img-src` | `'self'`, `data:`, `https:` | 외부 이미지 허용 |
| `connect-src` | `'self'` | API 호출 동일 출처만 |

### CSRF
- `express-session` `sameSite: 'lax'` 설정
- `httpOnly: true` 쿠키 플래그
- `secure: true` (production 환경)

### Rate Limiting
- 인증 엔드포인트 (`/api/auth/login`, `/api/auth/register`): 15분당 10회
- 아이디 중복 확인 (`/api/auth/check-username`): 15분당 30회 (실시간 타이핑 고려)
- 어드민 API (`/api/admin/*`): 15분당 60회 (계정 탈취 시 대량 추출 차단)
- 일반 API (`/api/*`): 15분당 200회

### 어드민 페이지 보호
- `/admin` HTML 서빙에 서버사이드 `adminPageGuard` 미들웨어 적용
  - 비로그인 또는 role ≠ admin → `/` 리다이렉트
  - admin.html/admin.js 소스가 비인가자에게 노출되지 않음
- `/api/admin/*` 전체에 `requireAdmin` 미들웨어 이중 보호

### 파일 업로드 (어드민 전용)
- 확장자 화이트리스트: jpg, jpeg, png, webp, gif
- 파일 크기 5MB 제한 (base64 7MB 문자열 길이 기준)
- 파일명 자동 생성 (`bc_timestamp_random.ext`) — path traversal 방지
- 어드민 권한 필수 (`requireAdmin` 가드)

### 인증
- 비밀번호 `bcryptjs` 해싱
- 세션 기반 인증 (`express-session` + SQLite 세션 스토어)
- 역할 체크: `user.role === 'admin'` 기준 (username 하드코딩 금지)

### 세션 소유권 검증
- `lib/sessionOwnership.js` — `verifyOwnership(sessionId, req, res)` 헬퍼
  - 로그인 유저: `session.user_id === req.session.userId` 일치 여부 검증
  - 게스트: `session.user_id IS NULL` + `session.guest_id === req.session.guestId` 검증
- server.js 미들웨어: 비로그인 최초 요청 시 `randomUUID()` guestId 자동 발급 (서버 세션 저장)
- 적용 엔드포인트: `GET /api/sessions/:id`, `PUT /:id/safety`, `POST /api/chat` (기존 세션), `POST /api/chat/regenerate`, `GET|PUT /api/sessions/:id/note`
- 게스트 세션 목록: `listSessionsByGuest` — `guest_id = ?` 조건으로 본인 세션만 반환

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
- 세션 소유권: 존재하지 않는 세션 404, 타 게스트 세션 403, 자신의 세션 200
