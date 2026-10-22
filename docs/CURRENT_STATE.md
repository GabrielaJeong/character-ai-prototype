# CURRENT_STATE.md

> Folio 현재 상태 스냅샷. 다음 세션 시작 시 빠른 파악용.
> 최종 업데이트: 2026-10-23 (v0.33 기준 — Phase A 완료, 프로덕션 cutover 완료)
> **재가동 점검 1차 세션 종료.** PR 5건 dev 머지, 2건 열린 채 대기. **main 배포는 보류**.
> 다음 세션은 아래 '남은 작업'의 열린 PR 2건부터 이어간다.

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

## 🔧 재가동 점검 (2026-10-21 ~ 10-23, 1차 세션 종료)

> v0.33(2026-09-05) 이후 7주 공백 뒤 재가동. 조사 결과 전문은 세션 로그 기준이며,
> 아래는 **다음 세션이 이어받기 위한 상태 요약**이다.

### PR 현황 — **main 배포는 보류**

**dev 에 머지됨 (2026-10-22)**

| PR | 브랜치 | 내용 |
|---|---|---|
| #1 | `chore/node-24` | Node 24 통일 — `engines: "24.x"`·`.nvmrc`·CI 3곳 |
| #2 | `chore/dep-audit-2026-10` | `npm audit fix` — root critical/high → 0 |
| #4 | `fix/session-secret-guard` | `SESSION_SECRET` 가드의 `NODE_ENV` 의존 구멍 차단 |
| #3 | `chore/layer3-model-alignment` | 서빙 모델 일치 + `messages.served_model` |
| #5 | `fix/image-metadata-strip` | PNG 텍스트 청크 제거 — ihwa 25MB → 1.77MB, 프롬프트 노출 차단 |

**열린 채 대기 — 다음 세션 시작점**

| PR | 브랜치 | 내용 | CI | 상태 |
|---|---|---|---|---|
| **#6** | `chore/next-15` | Next 14 → 15 + React 19 (async params 4파일) | ✅ job·check 모두 success | **머지만 남음** |
| **#7** | `fix/test-db-isolation` | 워커별 임시 DB 로 테스트 격리 | ✅ | 머지 대기 |

머지는 매번 base 를 dev 최신으로 올려 CI 를 재실행했다 — `ci.yml` 트리거가 `[main, dev]`
한정이라 **브랜치 푸시만으로는 CI 가 돌지 않는다. PR 을 열어야** `pull_request` 트리거가 걸린다.

> **`web` job 이 `in_progress` 로 멈추는 현상**: run 레벨은 `success` 이고 로그에
> `Compiled successfully`·`Complete job` 까지 찍혔는데 job/check-runs 상태만 갱신이 안 됐다.
> `check-runs` API 로 교차 확인해도 동일. 같은 run 을 **재실행(attempt 2)** 하면 정상이 된다.
> 머지 전 job 레벨까지 확인할 것.

> **main 배포 보류 이유**: 배포 전 R5-1(Railway Volume·`RUNTIME_DATA_DIR`) 확인이 선행돼야
> 하고, 2026-10-21~22 Railway 플랫폼 장애로 빌드가 단계적으로만 풀리는 중이었다.

### 완료된 작업

- **의존성**: root critical 1·high 8 → **0**. `proxy-addr` critical(IP 스푸핑 — limiter 5종이 전부 IP 기반) 해소. web 9 → 5
- **Node 버전**: 로컬 24.14.1 / CI 20 / Railway 미지정 → 전부 24 로 고정. `better-sqlite3@12.8.0` 이 Node 24 공식 지원(`engines`) + 클린 설치 prebuilt 확인
- **모델 정합성**: 자동 라우팅 발견(`3.7-flash`→`3.8-flash`, `3.5-flash`→`3.6-flash`) → 피커 중복 제거, 기본값 `gemini-3.8-flash` 명시, `LEGACY_MODEL_ALIASES` 추가 (L-023)
- **문서**: `CUTOVER_CHECKLIST` 실측 항목 10개 근거와 함께 체크 (L-024), `PRODUCTION_PLAN` 7.3 신설
- **테스트 키 분리**: 로컬 `.env` 를 테스트 전용 키로 교체 (L-023 예산 규칙 ⑤ 충족). `.env.example` 에 발급처 분리 규약 명시
- **이미지 자산**: PNG 텍스트 청크 제거로 29.09MB → 6.85MB. 동시에 공개돼 있던 NovelAI 생성 프롬프트 차단 (PR #5, D-021)
- **CI 실패 진단**: `database is locked` 원인 규명 → 테스트 DB 격리로 해결 (PR #7). 진단 중 개발 DB 유실 사고 (L-026)
- **Vercel 중복 정리**: `-vn3a` Pause + Git 연결 해제 (L-025)

### 남은 작업

| # | 작업 | 블로커 |
|---|---|---|
| 1 | **R5-1 확인** — `railway login` → `railway variables \| grep RUNTIME_DATA_DIR` + `railway volume list` | Railway CLI 인증 만료 + 플랫폼 장애. **DB 는 `DB_PATH` 로 이미 영속화**(체크리스트 §9), 위험은 업로드 파일에 한정 |
| 2 | `dev` → `main` 배포 | Railway 빌드 중단 해제 대기. 순서: **R5-1 확인 → 배포**. dev 가 main 보다 30+ 커밋 앞섬 |
| 3 | **Next 15 머지** (PR #6) | CI 통과, 머지만 남음. **16 은 보류** — 아래 참조 |
| ~~4~~ | ~~`ihwa.png` 25MB → 다른 캐릭터 수준~~ | ✅ **PR #5** — 25,074,295 → **1,771,506 B**(-92.9%). 원인은 압축이 아니라 tEXt 22.2MB. 무손실(IDAT 바이트 동일). 머지 대기 |
| 5 | **기본 모델 재벤치마크** | `gemini-3.8-flash.md` 는 3.7 기준 임시 보정. TTFT 수치(4.6s)도 3.7 요청 기준 |
| 6 | SSE-over-proxy 검증 (§3-1) | cutover 후에도 기록 없음 |
| 7 | **`actions/checkout`·`actions/setup-node` @v4 → @v5** | 미착수. 전 CI 런에 `Node.js 20 is deprecated... forced to run on Node.js 24` 경고. 액션 자체가 Node 20 타깃이라 나는 것으로 우리 런타임과 무관하며 동작엔 지장 없다. 경고 제거 목적 |
| ~~8~~ | ~~Vercel 프로젝트 중복 정리~~ | ✅ **완료 (2026-10-22)** — `-vn3a` **Pause + Git 연결 해제**. 교훈은 L-025 |
| 9 | **PR #6·#7 머지** | 둘 다 CI 통과. base 를 dev 최신으로 올리고 job 레벨 확인 후 머지 |
| 10 | **vitest 취약점 2건** (`@vitest/mocker`·`vitest`, 둘 다 `fix: true`) | 별도 브랜치·PR 로 처리하기로 함. 미착수 |
| 11 | **로컬 개발 DB 재구성** | 사고로 유실(L-026). 방법: 앱에서 회원가입 → `node scripts/admin-reset.js <email> <pw> admin`. `demo_user` 는 `DEMO_MODE=true` 에서 체험 로그인 시 자동 생성. **격리(PR #7) 머지 후에 할 것** — 안 그러면 테스트가 또 오염시킨다 |
| 12 | **`.claude/settings.json` 권한 설정 적용** | 안 작성 완료, **사용자 확인 대기**. 아래 '대기 중인 확인' 참조 |
| 13 | `db/chat.db` 테스트 잔여물 정리 | `auth_sessions` 3행·`notifications` 4행. 격리 확인 후 지워도 된다고 승인받음 — **지우기 전 재확인** |

### 알려진 미해결 사항

- ~~**Vercel 프로젝트가 2개**~~ → **2026-10-22 `-vn3a` Pause + Git 연결 해제로 정리됨** (L-025).
  아래는 당시 실측 기록 — `character-ai-prototype` / `character-ai-prototype-vn3a`.
  `-vn3a` 는 Vercel 이 프로젝트명 충돌 시 붙이는 접미사라 **같은 repo 를 두 번 import** 한 결과로 보인다.
  2026-10-22 PR 체크에서 처음 드러났고 **repo·문서 어디에도 기록이 없다**. 실측 결과:
  - 둘 다 동일한 Folio 앱을 서빙 (루트 HTML 12,850 bytes 바이트 단위 동일)
  - 둘 다 `BACKEND_ORIGIN` 설정됨 — `/api/*` 가 같은 Railway 백엔드로 프록시 (`X-Railway-*` 통과)
  - 둘 다 `/images` 프록시·`/admin` 미들웨어 307 정상
  - 즉 **같은 DB 를 보는 공개 진입점이 두 개**다. 세션 쿠키는 `vercel.app` 이 PSL 등재 도메인이라
    서로 공유되지 않는다 (L-022)
  - Railway 의 `FRONTEND_ORIGIN` 은 접미사 없는 쪽을 가리킨다 → 그쪽이 운영
  - 각 프로젝트의 production 브랜치·root directory·env 는 **대시보드에서만 확인 가능**
- `prompts/models/gemini-3.7-flash.md` — 별칭이 Layer 3 조회 전에 걸려 **더 이상 로드되지 않는 고아**. `gemini-3.8-flash.md` 의 출처라 남겨뒀다
- `sessions.model` 컬럼 DEFAULT 가 `'claude-sonnet-4-6'` — v0.33 에서 제거된 모델. 세션 생성 시 항상 명시값이 들어가 실害는 없으나 stale
- ~~서빙 모델 로깅 미구현~~ → **PR #3 에서 구현**. `lib/streamReply.js` `onMeta` + `messages.served_model`. 라이브 검증 완료(Claude·Gemini 각 1회)
- **생성 프롬프트가 git 이력에 남아 있다** — PR #5 가 현재 파일에서는 제거했으나 **과거 blob 에는 남는다**.
  → **D-021: 이력 재작성은 하지 않기로 결정.** 공개 저장소라 이미 복제됐을 수 있어 효과가 제한적이고,
  되돌릴 수 없는 force push 비용 대비 노출 자산(이미지 프롬프트)의 가치가 낮다.
  이미지 추가 시 메타데이터 제거를 `SESSION_CHECKLIST` 에 추가함
- root `@anthropic-ai/sdk` 0.86.1 → 0.137.0 (moderate, semver major)
- web 잔여 취약점: PR #6(Next 15)로 **critical 1 → 0**. 남은 9건 중 `postcss`·`next` 는 `next@16.4.2` 필요,
  `eslint-config-next` 계열은 npm 이 **다운그레이드를 fix 로 제시**하므로 따르지 않는다
- Next 15 빌드 경고 `Next.js inferred your workspace root` — 홈 디렉터리의 떠돌이 lockfile
  (`C:/Users/user/package-lock.json`)을 workspace root 로 골랐다. **repo 밖 파일이라 CI 영향 없음, 로컬 한정**

### Next 16 — 보류 (2026-10-23 결정)

**보안 사유는 해소됐다.** Next 15.5.28 로 올리면서 CVE-2026-29057(rewrites HTTP 스머글링,
15.5.13+ 에서 수정)과 Image Optimizer `remotePatterns` DoS(critical)가 모두 사라진다.

**16 은 변경 범위 대비 이득이 없다.** 남은 16 전용 취약점은 `postcss`·`next` 의 moderate/high
뿐인데, 그 대가로 `middleware.ts`→`proxy.ts` 개명, `next lint` 제거(ESLint CLI 전환),
ESLint flat config 전환, `next/image` 기본값 3종 변경(`qualities`·`minimumCacheTTL`·`imageSizes`),
Turbopack 기본화를 한꺼번에 받아야 한다.

재검토 트리거: 16 전용 critical 취약점이 나오거나, 15 가 EOL 수순에 들어갈 때.

### 대기 중인 확인 (다음 세션에서 물어볼 것)

1. **`.claude/settings.json` 권한 설정 적용 여부** — 안은 스크래치패드의
   `PROPOSED-claude-settings.json` 에 있다. `permissions.ask` 로 `rm`·`mv`·`git reset --hard`·
   `git clean`·`Remove-Item` 등과 `Edit(db/**)`·`Edit(.env)`·`Edit(public/uploads/**)` 를
   실행 전 승인 대상으로 둔다.
   한계: 권한 규칙은 **명령 문자열 앞부분 매칭**이라 `cd x && rm y`·리다이렉션·`find -exec rm`
   은 빠져나간다. 확률을 낮추는 장치이지 보증이 아니다
2. **`db/chat.db` 테스트 잔여물 삭제** — 승인은 받았으나 지우기 전 재확인하기로 함
3. **로컬 개발 DB 재구성 시점** — PR #7(격리) 머지 후

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
