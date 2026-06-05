# CURRENT_STATE.md

> Folio 현재 상태 스냅샷. 다음 세션 시작 시 빠른 파악용.
> 최종 업데이트: 2026-06-04 (React 마이그레이션 Phase A — 어드민 제외 전 화면 이식 완료)

---

## 🔄 React (Next.js) 마이그레이션 — Phase A (진행 중)

> Vanilla SPA(`public/`) → Next.js 14 App Router + TS(`web/`). 상세: `web/MIGRATION_HISTORY.md`.
> `dev` 브랜치에서 진행. cutover 전까지 `public/` SPA가 프로덕션. **SSE 전환으로 일부 API는 web 전용** (D-019).

### 이식 완료 화면 (web/app/)
- [x] 홈 `/` (큐레이션: 추천/공지/TOP.creators/GENRE/UPCOMING/footer)
- [x] 캐릭터 인트로 `/character/[id]` (hero/safety segment/탭/세계관)
- [x] 페르소나 4종 `/persona`, `/persona/new`, `/persona/select`, `/persona/select/[id]`
- [x] 채팅 `/character/[id]/chat` (SSE 스트리밍/재생성/노트·프로필 모달/기존 세션 로드)
- [x] 히스토리 `/history`, 마이페이지 `/mypage` (정보수정/성인인증/아바타/탈퇴/탭)
- [x] 인증 `/login`(로그인·가입·비번찾기), `/reset-password`
- [x] 탐색 `/explore` — 큐레이션 뷰(검색+태그+grid) + 랭킹 뷰 + BROADCAST/TAG.CLOUD/EDITOR.PICKS (Day 10.1~10.3)
- [x] 알림 `/notification` (Day 11), 크리에이터 `/creator/@[handle]` (Day 12)
- [x] 빌더 `/builder` `/builder/chat` `/builder/manual` `/builder/preview` (Day 13)
- [x] 페르소나 상세/편집 `/persona/[id]` (Day 14, 전체 필드 영구 편집)
- [x] 404 `not-found` / 에러 `error.tsx`

### 미이식 화면
- [~] **어드민 `/admin`** — Step 1(서버 게이트 middleware) + Step 2 진행 중. 완료: 셸, 유저, 캐릭터, 알림(`/admin/notifications`), 모더레이션(`/admin/moderation`). 남음: curation(가장 큼: 드래그/업로드/히스토리)/dashboard(차트)/eval(AI 실행). 그 전까진 기존 `public/admin.html`(Express adminPageGuard)이 운영용.
- [ ] mypage 메뉴 placeholder (좋아요/팔로잉/설정/고객지원) — 원본도 미구현 toast. 기능 자체가 없음

### 인프라 (web/)
- SSE 스트리밍(`lib/streamReply.js`), zustand 스토어, SWR 훅
- 공통 훅: `useRequireAuth`, `useAdultContent`, `useDragScroll`, `lib/search.ts`
- 검증 하네스: type-check(항상)/lint(UI)/build(새 라우트)/jest(백엔드). build 후 `.next` 그대로 둠(IDE 타입), dev는 `predev` 훅이 정리 (ML-003)
- **서버 측 auth 첫 도입**: `web/middleware.ts` — `/admin*` 진입 시 세션 쿠키를 백엔드 `/api/auth/me`로 포워드해 role 검증. 서버 fetch origin은 `API_INTERNAL_URL`(없으면 dev `localhost:3000`) → **prod 배포 시 env 설정 필요**
- 백로그(cutover 전): `docs/PRODUCTION_PLAN.md` 9.5 (파일 영속화·Builder limiter·아바타 서버검증·회귀테스트)

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
- [x] **업데이트 자동 알림** (ReleaseNotify — CHANGELOG 변경 시 AI가 알림 자동 생성, DB 기반 중복 차단)
- [x] **404 페이지** — 잘못된 URL / 삭제된 캐릭터 명시적 처리
- [x] **/login 과 /signup URL 분리** — 회원가입 view에서 URL도 /signup으로 동기화
- [x] **로그아웃 확인 모달**
- [x] **페르소나 플로우 URL 분리** (/persona/select, /persona/new 명시적 분리)

### 어드민 기능
- [x] 대시보드 (PV/UV/DAU/MAU, 그래프 2열 병렬)
- [x] 캐릭터성 평가 (LLM Self-Eval)
- [x] 유저/캐릭터/모더레이션 관리
- [x] 큐레이션 관리 (드래그앤드롭)
- [x] 알림 등록 관리
- [x] **서버사이드 어드민 페이지 가드** (admin.html 비인가 노출 차단)
- [x] **어드민 전용 rate limiter** (60회/15분)
- [x] **마이페이지에서 어드민 대시보드 진입 버튼** (role === 'admin' 일 때만 표시)
- [x] **임시 부트스트랩 엔드포인트** — `POST /api/auth/_bootstrap-admin` (BOOTSTRAP_SECRET env로 게이트, D-018)

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
- L-013: 프로덕션 환경변수 검증 부재 (SESSION_SECRET / NODE_ENV 누락도 silent 기동)
- L-014: AI 어시스턴트의 시크릿 값 echo 위험
- L-015: Railway 컨테이너 ephemeral 파일시스템 — 매 배포 데이터 손실
- L-016: Volume 마운트 경로가 코드 디렉토리와 충돌 → 모듈 로드 실패
- L-017: `railway run`은 로컬 실행 — 컨테이너 / Volume 접근 불가

---

## 배포 상태

- Railway 자동 배포 중 (GitHub `main` push 시)
- 커스텀 도메인 적용 (`folio-charc.up.railway.app`)
- GitHub Actions CI 통과 (49개 테스트, jest forceExit으로 워커 종료 보장)
- 환경변수: `DEMO_MODE=true` 설정 시 데모 체험 활성화
- 포트폴리오 사이트 (`gabby-pm-portfolio.vercel.app`) iframe 임베딩 가능
