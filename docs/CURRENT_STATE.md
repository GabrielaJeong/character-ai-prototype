# CURRENT_STATE.md

> Folio 현재 상태 스냅샷. 다음 세션 시작 시 빠른 파악용.
> 최종 업데이트: 2026-04-29 (v0.27)

---

## 구현 완료 기능

### 유저 기능
- [x] 4명 프리빌트 캐릭터 대화 (이화, 영일, 지세현, 박재헌)
- [x] 멀티 모델 (Claude 3종 + Gemini 3종, 기본 Gemini 3.1 Pro)
- [x] 소설/채팅 모드, 응답 재생성 + 페이지네이션
- [x] 캐릭터 빌더 (AI 대화형 + 직접 제작)
- [x] 유저 페르소나 시스템
- [x] 콘텐츠 등급 시스템 (all / toggleable / adult_only)
- [x] 책갈피, 좋아요 (UI만, API 미연결)
- [x] 탐색 페이지 (큐레이션 + 랭킹)
- [x] 알림 시스템 (NOTICE / SOCIAL / SYSTEM)
- [x] 크리에이터 시스템 (@username, 프로필 페이지)
- [x] 비밀번호 찾기 (데모)
- [x] **장기기억** (대화 요약 자동 저장 + 다음 세션 주입, 모델 제공사별 분기)
- [x] **포트폴리오 데모 모드** (DEMO_MODE=true, 로그인 없이 체험하기)
- [x] **업데이트 자동 알림** (ReleaseNotify — CHANGELOG 변경 시 AI가 알림 자동 생성)

### 어드민 기능
- [x] 대시보드 (PV/UV/DAU/MAU, 그래프 2열 병렬)
- [x] 캐릭터성 평가 (LLM Self-Eval)
- [x] 유저/캐릭터/모더레이션 관리
- [x] 큐레이션 관리 (드래그앤드롭)
- [x] 알림 등록 관리
- [x] **서버사이드 어드민 페이지 가드** (admin.html 비인가 노출 차단)
- [x] **어드민 전용 rate limiter** (60회/15분)

### 보안
- [x] helmet (CSP, 보안 헤더)
- [x] rate limiting (auth 10회 / admin 60회 / api 200회)
- [x] 세션 소유권 검증 (`verifyOwnership`) — 채팅·세션·노트
- [x] 게스트 세션 격리 (`guest_id` 컬럼)
- [x] XSS 방지 (`escapeHtml` 5종)
- [x] CSRF (SameSite=Lax)
- [x] CSP `frame-ancestors`로 포트폴리오 iframe 임베딩 허용

---

## 인프라 / 하네스

- [x] CHANGELOG.md 자동 생성 훅 (`[release]` 태그 커밋 시)
- [x] CLAUDE.md (클로드 코드 진입점, Red Flags 11종)
- [x] docs/CONVENTIONS.md (코딩 규칙 + 모바일 3종 체크리스트)
- [x] docs/DECISIONS.md (설계 결정 16건 — D-001~D-016)
- [x] docs/LESSONS.md (실수 패턴 12건 — L-001~L-012)
- [x] docs/SECURITY.md (보안 정책 + 어드민 보호)
- [x] docs/DESIGN_SYSTEM.md (토큰·컴포넌트·인터랙션)
- [x] docs/SESSION_CHECKLIST.md
- [x] ESLint + Prettier + .editorconfig
- [x] Jest + supertest (49개 테스트 통과, `forceExit: true`)
- [x] GitHub Actions CI
- [x] **Git 브랜치 전략** (작업 = `dev`, 릴리즈 = `main` merge)

---

## 미구현 / 로드맵

### Phase 2 (가설 검증 예정)
- [ ] AI 빌더 A/B 테스트 (가설 4)
- [ ] LLM Self-Eval 자동화 회귀 테스트 (가설 5)
- [ ] 콘텐츠 등급 시스템 유저 설정 변경 빈도 측정 (가설 6)

### Phase 3 (설계 단계)
- [ ] 모델 라우팅 자동화 (가설 7)
- [ ] 크리에이터 팔로우 시스템 (가설 8 확장)

### 기능 미구현
- [ ] 좋아요 기능 API 연동 (현재 UI만)
- [ ] 댓글 시스템 (UI placeholder만)
- [ ] 토큰 결제 시스템 (UI placeholder만)
- [ ] 소셜 로그인 (Google, Kakao)
- [ ] **RAG 기반 벡터 기억 (B안)** — 현재 단일 요약만 저장
- [ ] **2FA / 어드민 IP 화이트리스트** (SECURITY.md 알려진 제한)

### 하네스 확장
- [ ] Sentry 에러 로깅 (프로덕션 단계)
- [ ] 테스트 커버리지 50% 달성
- [ ] React 마이그레이션 준비 작업 (D-014 참조)
  - 전역 상태 단일 객체화
  - app.js 화면 단위 분리
  - onclick 인라인 → 함수 분리

---

## 최근 발견된 버그 패턴 (전체)

자세한 내용은 docs/LESSONS.md 참조.

- L-001: API 응답 필드 누락
- L-002: Config ↔ Source drift (ihwa notes)
- L-003: Static HTML + JS renderer 충돌
- L-004: 프롬프트 노하우 공개 위험
- L-005: 역할 체크 단일 필드 의존
- L-006: 버전 번호 중복 기록 (`[release]` 태그 도입)
- L-007: escapeHtml 미적용 innerHTML XSS
- L-008: Railway 프록시 trust proxy 미설정 → rate limit IP 오인식
- L-009: helmet CSP `script-src-attr: 'none'` 기본값 → onclick 차단
- L-010: UUID 세션 ID를 소유권 증명으로 오인 (Security Through Obscurity)
- L-011: 인증 게이트 → 로그인 → 뒤로가기 무한 루프 (replaceState 미사용)
- L-012: 모바일 인터랙션 전반 미고려 (touch-action / 44px / :active 누락)

---

## 배포 상태

- Railway 자동 배포 중 (GitHub `main` push 시)
- 커스텀 도메인 적용 (`folio-charc.up.railway.app`)
- GitHub Actions CI 통과 (49개 테스트, jest forceExit으로 워커 종료 보장)
- 환경변수: `DEMO_MODE=true` 설정 시 데모 체험 활성화
- 포트폴리오 사이트 (`gabby-pm-portfolio.vercel.app`) iframe 임베딩 가능
