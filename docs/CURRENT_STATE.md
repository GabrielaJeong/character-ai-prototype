# CURRENT_STATE.md

> Folio 현재 상태 스냅샷. 다음 세션 시작 시 빠른 파악용.
> 최종 업데이트: 2026-10-22 (v0.33 기준 — Phase A 완료, 프로덕션 cutover 완료)
> **재가동 점검 진행 중** — 아래 '재가동 점검' 절 참조. 미푸시 브랜치 3개 있음.

---

## ✅ React (Next.js) 마이그레이션 — Phase A (완료)

> Vanilla SPA(`public/`) → Next.js 14 App Router + TS(`web/`). 상세: `web/MIGRATION_HISTORY.md`.
> **2026-08-30 cutover 완료** (D-019). 레거시 SPA 제거 — `public/index.html`·`admin.html` 없음.
> 현재 Express는 **API + 정적 자원 전용**, 화면은 전부 `web/`.

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
- [x] **어드민 `/admin`** — **완료**. 서버 게이트(middleware) + 8 페이지(대시보드/유저/캐릭터/**모델 관리**/모더레이션/알림/eval/큐레이션). 큐레이션은 드래그/이미지업로드/스냅샷 히스토리/미리보기 전부. 모델 관리는 Layer 3 프롬프트 좌목록+우에디터. web 신규 의존성: chart.js + react-chartjs-2.
  - PV 집계에서 `/admin` 제외(server.js) — 어드민 조회가 앱 PV 부풀리던 버그 수정. 과거 admin PV 58행 정리 완료.
  - **cutover 완료.** `public/admin.html`(Express adminPageGuard)은 제거됐고 `/admin`이 유일한 어드민이다.
  - 남은 것 = R5 백로그 중 **R5-5(회귀 테스트) 부분 완료**분뿐. `docs/PRODUCTION_PLAN.md` 9.5 참조.
- [ ] mypage 메뉴 placeholder (좋아요/팔로잉/설정/고객지원) — 원본도 미구현 toast. 기능 자체가 없음

### 인프라 (web/)
- SSE 스트리밍(`lib/streamReply.js`), zustand 스토어, SWR 훅
- 공통 훅: `useRequireAuth`, `useAdultContent`, `useDragScroll`, `lib/search.ts`
- 검증 하네스: type-check(항상)/lint(UI)/build(새 라우트)/jest(백엔드). build 후 `.next` 그대로 둠(IDE 타입), dev는 `predev` 훅이 정리 (ML-003)
- **서버 측 auth 첫 도입**: `web/middleware.ts` — `/admin*` 진입 시 세션 쿠키를 백엔드 `/api/auth/me`로 포워드해 role 검증. 서버 fetch origin은 `API_INTERNAL_URL`(없으면 dev `localhost:3000`) → **prod 배포 시 env 설정 필요**
- 백로그(cutover 전): `docs/PRODUCTION_PLAN.md` 9.5 (파일 영속화·Builder limiter·아바타 서버검증·회귀테스트)

---

## 🔧 재가동 점검 (2026-10-21 ~ 진행 중)

> v0.33(2026-09-05) 이후 7주 공백 뒤 재가동. 조사 결과 전문은 세션 로그 기준이며,
> 아래는 **다음 세션이 이어받기 위한 상태 요약**이다.

### 미푸시 브랜치 — 전부 로컬 커밋만, push 안 함

| 브랜치 | 커밋 | 내용 | 상태 |
|---|---|---|---|
| `chore/dep-audit-2026-10` | `daddf0d` | `npm audit fix` (root+web, `--force` 미사용) | ✅ 검증 완료 |
| `chore/node-24` | `7f00ade` | Node 24 통일 — `engines`·`.nvmrc`·CI 3곳 | ✅ 검증 완료 |
| `chore/layer3-model-alignment` | `a0651e8` | 서빙 모델 일치 — `gemini-3.8-flash` 명시 + 구 ID 별칭 | ✅ 검증 완료 |

세 브랜치 모두 `dev` 기준으로 분기했고 서로 독립이다. 각각 백엔드 jest 60 · eslint 0 error ·
web tsc · vitest 36 통과 확인.

> **푸시 금지 이유**: Railway 가 `main` 자동 배포, Vercel 도 `main` 프로덕션(+모든 브랜치 프리뷰 배포).
> 그리고 2026-10-21 Railway 플랫폼 장애로 **전 리전 빌드 중단** 상태였다.

### 완료된 작업

- **의존성**: root critical 1·high 8 → **0**. `proxy-addr` critical(IP 스푸핑 — limiter 5종이 전부 IP 기반) 해소. web 9 → 5
- **Node 버전**: 로컬 24.14.1 / CI 20 / Railway 미지정 → 전부 24 로 고정. `better-sqlite3@12.8.0` 이 Node 24 공식 지원(`engines`) + 클린 설치 prebuilt 확인
- **모델 정합성**: 자동 라우팅 발견(`3.7-flash`→`3.8-flash`, `3.5-flash`→`3.6-flash`) → 피커 중복 제거, 기본값 `gemini-3.8-flash` 명시, `LEGACY_MODEL_ALIASES` 추가 (L-023)
- **문서**: `CUTOVER_CHECKLIST` 실측 항목 10개 근거와 함께 체크 (L-024), `PRODUCTION_PLAN` 7.3 신설

### 남은 작업

| # | 작업 | 블로커 |
|---|---|---|
| 1 | **R5-1 확인** — `railway login` → `railway variables \| grep RUNTIME_DATA_DIR` + `railway volume list` | Railway CLI 인증 만료 + 플랫폼 장애. **DB 는 `DB_PATH` 로 이미 영속화**(체크리스트 §9), 위험은 업로드 파일에 한정 |
| 2 | 세 브랜치 머지 → `dev` → `main` 배포 | Railway 빌드 중단 해제 대기. 순서: R5-1 확인 → `chore/dep-audit` 배포 |
| 3 | **Next 14 → 15 → 16** | 미착수. 영향 집계: async `params` 4개 파일(전부 `'use client'` → `use()`), `cookies/headers/searchParams`/Route Handler **0건**. 16 추가: `middleware.ts`→`proxy.ts`, `next lint` 제거, ESLint flat config |
| 4 | `ihwa.png` 25MB → 다른 캐릭터 수준(1.5~2MB) | 미착수 |
| 5 | **기본 모델 재벤치마크** | `gemini-3.8-flash.md` 는 3.7 기준 임시 보정. TTFT 수치(4.6s)도 3.7 요청 기준 |
| 6 | SSE-over-proxy 검증 (§3-1) | cutover 후에도 기록 없음 |

### 알려진 미해결 사항

- `prompts/models/gemini-3.7-flash.md` — 별칭이 Layer 3 조회 전에 걸려 **더 이상 로드되지 않는 고아**. `gemini-3.8-flash.md` 의 출처라 남겨뒀다
- `sessions.model` 컬럼 DEFAULT 가 `'claude-sonnet-4-6'` — v0.33 에서 제거된 모델. 세션 생성 시 항상 명시값이 들어가 실害는 없으나 stale
- 서빙 모델 로깅 미구현 — Claude `message_start.message.model` / Gemini `chunk.modelVersion` 으로 가능. `lib/streamReply.js` 에 `onMeta` 콜백 추가 + `sessions`/`moderation_logs` 에 컬럼 필요
- root `@anthropic-ai/sdk` 0.86.1 → 0.137.0 (moderate, semver major)
- web 잔여 취약점 5건은 전부 `next@16.4.2` 필요 → 위 #3 과 묶임

---

## 구현 완료 기능

### 유저 기능
- [x] 4명 프리빌트 캐릭터 대화 (이화, 영일, 지세현, 박재헌)
- [x] 멀티 모델 12종 — Claude 6종(Opus 5 / Sonnet 5 / Opus 4.8·4.7·4.6 / Haiku 4.5) + Gemini 6종(3.7 Flash / 3.6 Flash / 3.5 Flash / 3.1 Pro / 2.5 Pro·Flash). **기본 `gemini-3.7-flash`**(TTFT 최적화, v0.33). 정규 목록: `lib/chatModels.js`. 모델별 Layer 3 보정 프롬프트는 어드민 `/admin/models`에서 편집(`prompts/models/{id}.md`)
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
- [x] docs/DECISIONS.md (설계 결정 20건 — D-001~D-020)
- [x] docs/LESSONS.md (실수 패턴 22건 — L-001~L-022)
- [x] docs/SECURITY.md (보안 정책 + 어드민 보호)
- [x] docs/DESIGN_SYSTEM.md (토큰·컴포넌트·인터랙션)
- [x] docs/SESSION_CHECKLIST.md
- [x] ESLint + Prettier + .editorconfig
- [x] Jest + supertest — 백엔드 **60개** 통과 (`forceExit: true`)
- [x] Vitest — web **36개** 통과 (어드민 게이트·store·SSE 파서)
- [x] GitHub Actions — CI(백엔드 + web job) + **Sync to Notion**(repo 문서 → Notion 미러)
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
- L-018: SSR 오버레이(Splash) FOUC — 진짜 원인은 fadeIn 0.3s 애니메이션
- L-019: React StrictMode의 "한 번만 실행" 가드는 useState 아닌 useRef
- L-020: Express SSE 클라이언트 abort 감지는 `res.on('close')` (req.on 아님)
- L-021: 외부 코드리뷰 finding은 severity·영향범위로 분리, 묶음 적용 금지
- L-022: 포트폴리오 iframe 안에서는 세션 쿠키가 아예 전송되지 않음

---

## 배포 상태

- **구성**: 백엔드 Express(Railway) = API + 정적 자원 / 프론트 Next.js(`web/`) = 전 화면
  - `BACKEND_ORIGIN` — web(next.config·middleware)의 프록시 대상
  - `FRONTEND_ORIGIN` — Express가 남은 HTML 요청을 넘길 프론트 도메인 (미설정 시 404 JSON)
  - `RUNTIME_DATA_DIR` / `DB_PATH` — Railway Volume 경로 (R5-1·D-017)
- Railway 자동 배포 (GitHub `main` push 시), 커스텀 도메인 `folio-charc.up.railway.app`
- GitHub Actions — CI(백엔드 60 + web 36) / Sync to Notion
- 환경변수: `DEMO_MODE=true` 설정 시 데모 체험 활성화
- 포트폴리오 사이트 (`gabby-pm-portfolio.vercel.app`) iframe 임베딩 가능 (D-016·L-022)
