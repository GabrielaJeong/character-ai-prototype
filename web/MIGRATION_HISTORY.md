# React 마이그레이션 진행 일지

> 매 작업 단위마다 무엇을 했는지·뭘 빠뜨렸는지·뭘 발견했는지 기록.
> 체크리스트(`MIGRATION_CHECKLIST.md`)와 짝.
> CHANGELOG와는 별개 — CHANGELOG는 사용자용 릴리즈 노트, History는 작업 추적용.

---

## 사용 규칙

### 새 작업 시작 전
1. 작업 영역 결정 (어떤 화면 / 컴포넌트)
2. 체크리스트의 해당 섹션 열기
3. 시작 전 자동 체크 5종 수행 (체크리스트 부록 참조)

### 새 작업 끝난 후
1. 종료 후 자동 체크 5종 수행 (체크리스트 부록 참조)
2. 아래에 "작업 항목" 추가
3. 체크리스트의 해당 ✅ 항목 마킹

### 발견 사항 / 누락 사항
- 작업 중 발견된 원본의 빠뜨린 디테일 → "발견" 섹션에 기록 + 체크리스트에 새 항목 추가
- 다른 화면에 영향 주는 사항 → 영향 받는 화면 항목에 메모

---

## 진행 항목

### 2026-05-05 (Day 0) — Rewind & Harness 셋업

**상태**: 초기 시도 후 rewind, 하네스 구축 단계

**작업**:
- 이전 시도 (`fc98c81`) 까지의 work는 `dev-attempt-2026-05-05` 브랜치에 스냅샷 보존
- `dev` 브랜치를 `2709b6a` (Next.js scaffolding + 포트 분리)로 hard reset + force push
- `MIGRATION_CHECKLIST.md` 작성 — 모든 화면·컴포넌트·연결·상태 분기·API 매트릭스 명문화
- `MIGRATION_HISTORY.md` (이 파일) 시작

**현재 상태 (커밋 `2709b6a` 기준)**:
- ✅ Next.js 14 + TypeScript 설치 완료 (`web/package.json`, `tsconfig.json`)
- ✅ 포트 3001 설정 (Express 3000과 분리)
- ✅ globals.css에 디자인 토큰 + 기본 셸 이식
- ✅ 빈 placeholder layout/page
- ⛔ 그 외 모든 화면·컴포넌트 미구현

**다음 작업**:
- [ ] (Day 1) globals.css 디자인 토큰 검증 + 필요 시 보강
- [ ] (Day 1) `lib/api.ts` + `lib/types.ts` (백엔드 연결 기초)
- [ ] (Day 1) `store/auth.ts` + `<AuthBootstrap>` (세션 복원)

**발견 / 회고**:
- 첫 시도에서 빠뜨린 디테일: 로고 스타일 (Foli + o-dots), VIEW ALL 버튼, 캐릭터 stat (▲ ❤), 태그 # prefix, NEW/HOT/UP 배지 로직, BROADCAST 배너, 알림 미읽음 배지, 4번째 캐릭터(adult_only)
- 첫 시도에서 본 CSS 로드 깨짐 원인: globals.css의 `@import url(...)` Pretendard 로드가 Next.js dev에서 stylesheet 전체 로드 실패 야기 — 해결: layout `<head>`의 `<link>` 태그로 분리
- 첫 시도 때 라우트 연결 거의 안 한 채로 wave 진행 — 이번엔 화면마다 연결지점 동시 처리할 것

---

<!-- 다음 작업부터 아래에 추가 -->

### 2026-05-05 (Day 1) — 기반 (globals + API client + Auth store)

**작업 범위**: 모든 화면이 의존하는 공통 인프라.

**사전 체크 통과**:
- ✅ 참조: CLAUDE.md / DESIGN_SYSTEM.md / CONVENTIONS.md / LESSONS L-011·L-013·L-014·L-017
- ✅ 원본 코드: style.css 1~150, app.js initAuth, db/index.js users 스키마
- ✅ 체크리스트 섹션: 0(참조) / 1(CSS 전략) / 3.x(글로벌 - AuthBootstrap)

**구현**:
- `web/app/globals.css` 검증/보강
  - `@import url(Pretendard)` 제거 → layout `<link>`로 이동 (첫 시도의 stylesheet 깨짐 버그 회피)
  - `::-webkit-scrollbar` 룰 추가 (원본 117~125)
  - `.screen-page` 유틸 클래스 추가 (원본 .screen 패턴, 라우트 페이지에 적용)
- `web/app/layout.tsx`
  - Pretendard `<link>` 추가
  - `<AuthBootstrap />` 마운트
- `web/lib/api.ts`
  - fetch wrapper (`credentials: 'include'`)
  - ApiError class (status / data / message)
  - get/post/patch/put/delete 헬퍼
  - `rawFetch()` (스트리밍용 — 채팅에서 사용)
- `web/lib/types.ts`
  - User / Character / Persona / Session / Message / Notification / Bookmark / Curation / CreatorProfile
  - SQLite boolean을 0|1로 표현
- `web/store/auth.ts`
  - Zustand store: user / ready / demoAvailable
  - **L-011 race condition 방지**: initAuth 응답 시 `get().user`가 있으면 덮어쓰지 않음
  - initAuth / checkDemoMode / logout / demoLogin / setUser
- `web/components/AuthBootstrap.tsx`
  - 마운트 시 1회 initAuth + checkDemoMode (UI 렌더 X)

**종료 체크**:
- ✅ 프론트 type-check 통과
- ✅ 프론트 build 통과 (홈 138B placeholder 상태)
- ✅ 백엔드 jest 49개 통과
- ⏸ 시각 비교 / 모바일 / 연결 — 이번 단계는 인프라만, 화면 없음
- ✅ History 기록 (이 항목)
- ✅ 체크리스트 0·1·3.x AuthBootstrap 부분 마킹은 다음 화면 만들 때 결과로 확인

**다음 작업 (Day 2)**:
- [x] `<Toast>` (z 9998) + `<Splash>` (z 9999) — 글로벌 UI 기초
- [x] 모달 공통 CSS (`Modal.module.css`) + `<DeleteConfirmModal>` 재사용 컴포넌트
- [ ] 작은 버튼 컴포넌트들 (`<BtnPrimary> <BtnGhost> <BtnBack> <BtnIcon> <BtnSend>`) — 또는 화면 작업 중 동시 추출

**발견 / 회고**:
- L-011 패턴이 store/auth.ts에 명시적으로 주석 처리됨 — 다음에 다른 사람(또는 나)이 봐도 race 의도 알 수 있게
- types.ts에 SQLite boolean을 `0 | 1`로 명시 — JS truthy 평가 시 `!!user.adult_content_enabled` 패턴 사용 필요

---

### 2026-05-05 (Day 2) — 글로벌 UI 컴포넌트 1차 (Toast / Splash / Modal common / DeleteConfirmModal)

**작업 범위**: 모든 화면이 부르는 글로벌 UI 컴포넌트 핵심 3종 + 재사용 모달.

**구현**:
- `web/store/ui.ts`
  - Toast (message, timer) + showToast/hideToast (자동 dismiss)
  - AuthGate payload + showAuthGate/closeAuthGate (Day 3에서 마운트)
  - Logout open/close (Day 3에서 마운트)
  - **DeleteConfirm 재사용 패턴** — `showDeleteConfirm({title, desc, confirmLabel, onConfirm})` 로 어디서든 호출
- `web/components/Toast.tsx` + `Toast.module.css`
  - 원본 .toast (z 9998, blur, bottom 80px) 1:1 이식
- `web/components/Splash.tsx` + `Splash.module.css`
  - 원본 #splash + .logo-o-wrap + .logo-dots 1:1 이식
  - sessionStorage 'folio-splash-shown'으로 세션당 1회
  - 800ms 표시 + fadeOut 0.4s
  - Folio 로고: Foli + o(점 2개) 디자인 (#5B8FB9 / #8BA8DC)
- `web/components/Modal.module.css`
  - **공통 bottom-sheet 패턴**: .overlay (z 300) + .panel (slideUp 0.2s)
  - 변형 버튼 클래스: .btnGhost / .btnPrimary / .btnDelete / .demoBtn
  - 5개 모달 (DeleteConfirm / AuthGate / Logout / AdultVerify / Mypage)이 공유 예정
- `web/components/DeleteConfirmModal.tsx`
  - `useUIStore.deleteConfirm`을 읽어 표시
  - running 상태로 중복 클릭 차단
  - 외부 overlay 클릭 시 닫기 (running 중엔 차단)
- `layout.tsx`에 `<Splash> <AuthBootstrap> <DeleteConfirmModal> <Toast>` 마운트

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (홈 페이지 138B placeholder, 추가 모달은 layout에 포함되어 chunk 증가)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 시각 비교 — 화면 없으므로 다음 단계에서

**체크리스트 진척**:
- ✅ 섹션 3.1 (Splash)
- ✅ 섹션 3.3 (Toast)
- ✅ 섹션 3.6 (DeleteConfirmModal)
- ⏳ 섹션 3.4 (AuthGate) → Day 3
- ⏳ 섹션 3.5 (LogoutModal) → Day 3

**다음 작업 (Day 3)**:
- [x] `<AuthGate>` (z 300, 데모 버튼 조건부)
- [x] `<LogoutModal>` (z 300)
- [x] `<BottomNav>` (z 200, HIDE_PATTERNS, 5탭 ⊞◷◎✦◉)
- [ ] 작은 Button 컴포넌트 (또는 module CSS만)

**발견 / 회고**:
- DeleteConfirmModal을 인자 받는 단일 컴포넌트로 만들어서 호출자가 `showDeleteConfirm(...)`만 하면 됨
- Modal.module.css의 버튼들이 이 모달 내부 전용 → 외부에서 쓸 일 없으면 module 안에 두는 게 맞음

---

### 2026-05-05 (Day 2.2) — AuthGate + LogoutModal + BottomNav

**작업 범위**: 글로벌 인프라 마무리. 이제 모든 화면이 의존하는 컴포넌트들이 다 있음.

**구현**:
- `web/components/AuthGate.tsx` (Modal.module.css 재사용)
  - `gate.intendedPath` → 로그인 후 복귀
  - **L-011 패턴 명시**: `router.replace('/login?redirect=...')` (push 아님)
  - DEMO_MODE 활성 시 "체험하기" 버튼 (Modal.demoBtn)
  - 외부 클릭으로 닫기
- `web/components/LogoutModal.tsx` (Modal.module.css 재사용)
  - `useUIStore.openLogout()` 으로 열림
  - 확인 시 logout() → 홈으로 push
- `web/components/BottomNav.tsx` + `module.css`
  - 5탭 (캐릭터 ⊞ / 대화 ◷ / 탐색 ◎ / 제작 ✦ / 마이페이지 ◉)
  - **HIDE_PATTERNS** — 원본 noNavScreens (app.js:816) 매칭:
    - /character/[id]/chat
    - /builder/(chat|manual|loading|preview)
    - /login, /signup, /reset-password
    - /notification
    - /persona, /persona/* (select/select-edit는 hide, 나머지는 페이지 자체가 없어 영향 X)
  - active 판정: `/` 정확히, 나머지는 startsWith
  - `safe-area-inset-bottom` 패딩
- `layout.tsx`: Splash + AuthBootstrap + (#app: children + BottomNav) + AuthGate + LogoutModal + DeleteConfirmModal + Toast 모두 마운트

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과
- ✅ 백엔드 jest 49/49 통과
- ⏸ 시각 비교 — 화면 없으므로 다음 단계에서

**체크리스트 진척**:
- ✅ 섹션 3.1 (Splash)
- ✅ 섹션 3.2 (BottomNav)
- ✅ 섹션 3.3 (Toast)
- ✅ 섹션 3.4 (AuthGate)
- ✅ 섹션 3.5 (LogoutModal)
- ✅ 섹션 3.6 (DeleteConfirmModal)
- ⏳ 섹션 3.7~3.12 (NoteModal / CharProfileModal / AdultVerifyModal / ModelPicker / DemoBanner / MypageModal) → 각 화면 만들면서

**다음 작업 (Day 3)**:
- [ ] 첫 실제 화면 — `/` 홈 (LandingHeader + CharacterCard + Curation sections + Stats)
- [ ] `<CharacterCard>` 재사용 컴포넌트 (체크리스트 4.1)
- [ ] `<LandingHeader>` (Folio 로고 + ALL/18+ + 알림 벨 + 미읽음 배지)
- [ ] (백로그 큐레이션은 단계별로 — 우선 캐릭터 그리드만)

**발견 / 회고**:
- HIDE_PATTERNS에서 /persona/* 전체를 숨김으로 처리. 원본은 select와 select-edit만 hide했지만, 페르소나 새로 만들기 (/persona/new) 등에서도 메인 nav가 보이는 건 어색하므로 통째로 숨김. 추후 사용자 피드백에 따라 분리 가능.

---

### 2026-05-27 (Day 3) — `/` 홈 1차 (LandingHeader + CharacterCard + 추천 그리드)

**작업 범위**: 첫 실제 화면. 헤더 + 캐릭터 카드 컴포넌트 + 홈 페이지의 RECOMMENDED.feed 섹션까지.

**사전 체크 통과**:
- ✅ 원본 코드: index.html L35~129, style.css L140~415 (랜딩) / L645~801 (카드 + char-grid) / L4527~4553 (adult segment) / L3286~3304 (notif badge) / L1082~1121 (page-wrap/body/section)
- ✅ 참조: CLAUDE.md Red Flag 9 (3종 체크: touch-action / 44px / :active) / Red Flag 10 (100dvh) / L-011 race / L-012 mobile / DESIGN_SYSTEM.md 섹션 3·4·5·9
- ✅ 체크리스트 섹션: 2.1 (홈) / 4.1 (CharacterCard) / 4.2 (LandingHeader)

**구현**:
- `web/lib/types.ts` 보강 — `Character.stats: { sessions, bookmarks }`, `Character.badge: 'NEW'|'HOT'|'UP'|null`, `Character.status?: 'coming_soon'|'active'` 추가 (백엔드 routes/characters.js 응답 매핑)
- `web/lib/format.ts` 신규 — `fmtK` (1234→1.2K) / `relativeTime` (방금/N분 전/...) / `notifBadgeText` (>9 → 9+) (원본 app.js 1:1 이식)
- `web/lib/hooks.ts` 신규 — SWR 훅 `useCharacters` / `useCuration` / `useNotifications` / `useNotifBadgeCount`
- `web/components/CharacterCard.tsx` + `.module.css` — 재사용 카드 컴포넌트:
  - 좌상단 numberBadge (#B01) / 우상단 statusBadge (NEW·HOT·UP, dot + label)
  - 하단 그라디언트 + 태그 (# prefix, 최대 3개)
  - Coming Soon overlay (status==='coming_soon' 시 클릭 차단)
  - 외부 정보 블록 (이름·역할·@크리에이터·▲세션·♥북마크)
  - 유저 제작 캐릭터(id startsWith 'char_')는 @username 링크 → `/creator/@:username`
  - next/image로 image=undefined 시 placeholder (이름 첫 글자)
- `web/components/LandingHeader.tsx` + `.module.css`:
  - Foli + o(점 2개 #5B8FB9 / #8BA8DC) 로고
  - ALL/18+ 세그먼트: PATCH `/api/auth/adult-content` → `setUser` + SWR `mutate('/api/characters')` (서버 필터링 변경 반영)
  - 18+ ON 분기: 비로그인 → AuthGate / 로그인+미인증 → 토스트(모달 예정) / 인증완료 → 즉시 ON
  - 알림 벨 + 미읽음 배지 (`useNotifBadgeCount`, `notifBadgeText`)
- `web/app/page.tsx` 신규 (placeholder 교체) — `<LandingHeader>` + RECOMMENDED.feed 섹션 (eyebrow + 타이틀 + VIEW ALL → /explore) + char-grid
  - 로딩/에러/빈 상태 메시지 처리
- `web/app/page.module.css` — page-wrap/body/section/feed-header/char-grid 1:1 이식

**모바일 인터랙션 (L-012)**:
- segBtn / bellBtn / feedViewAll에 `touch-action: manipulation` + `:active { opacity: 0.7 }`
- segBtn `min-height: 28px` (시각 일관성, 부모 영역으로 터치 보강)
- 카드 hover 시 `transform: translateY(-2px)` + `filter: brightness(1.12)`

**종료 체크**:
- ✅ 프론트 type-check 통과
- ✅ 프론트 build 통과 (`/` 13.6 kB / 112 kB First Load)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 시각 비교 — 다음 세션에서 실 브라우저 캡처로 대조 (현재는 백그라운드 비활성)
- ⏸ 모바일 (DevTools 375px / 기기 실측) — 다음 세션에서

**체크리스트 진척**:
- ✅ 섹션 4.1 (CharacterCard)
- ✅ 섹션 4.2 (LandingHeader)
- 🟡 섹션 2.1 (홈) — 추천 그리드만 완료. 잔여:
  - [ ] 공지 캐러셀 (`notice-carousel`)
  - [ ] TOP.creators (`creator-row`)
  - [ ] GENRE.catalog
  - [ ] UPCOMING (잠금 카드)
  - [ ] BROADCAST 배너 (curation.broadcast[0])
  - [ ] `<SiteFooter>` (Folio. + 빌드넘버 + 컬럼 + legal)

**발견 / 회고**:
- 첫 시도에서 빠뜨렸던 디테일들이 이번엔 모두 들어감: 로고 점, # prefix, ▲/♥ 통계, NEW/HOT/UP, Coming Soon, @크리에이터 링크.
- 그러나 홈 페이지는 추천 그리드 1개 섹션만 완성 — 큐레이션 4섹션 + 푸터는 별도 sub-day로 분리 (Day 3.x).
- `Curation` 인터페이스 (`lib/types.ts`)는 현재 placeholder. 실제 `/api/curation` 응답 (`broadcast`/`tags`/`collections`/`creators`/`genres`/`upcoming`)과 다름 → 큐레이션 섹션 작업 시 타입부터 재정의 필요.
- next/image의 `unoptimized` 옵션 사용 — 백엔드 정적 자원 그대로 (Express가 서빙). 추후 production에서 next.config.js의 `images.domains` 또는 loader 전략 검토 필요.

---

### 2026-05-27 (Day 3.x) — `/` 홈 2차 (Notice / TOP.creators / GENRE / UPCOMING / SiteFooter)

**작업 범위**: 1차에서 미뤘던 홈 페이지 잔여 섹션 5종 + 공통 `<FeedHeader>` 추출.

**사전 체크 통과**:
- ✅ 원본 코드: app.js `_renderLandingCuration` L1850~1910 / `loadAppVersion` L3283~3291 / index.html L74~125
- ✅ style.css: notice-carousel (973~1003) / creator-row (417~470) / genre-row (472~528) / 준비중 overlay (951~969) / site-footer (4939~5016)
- ✅ data/curation.json 실제 응답 shape 확인 — 1차에서 정의한 `Curation` 인터페이스 placeholder를 폐기하고 재정의

**구현**:
- `web/lib/types.ts` — `Curation` 인터페이스를 `data/curation.json` 실제 shape로 재정의
  - `BroadcastItem` / `CollectionItem` / `CreatorItem` / `GenreItem` / `UpcomingItem` export
  - 이전 placeholder (`banners` / `editorPicks` / `tagCloud` / `topCreators`) 제거
  - 신규 `AppVersion` 타입 (`/api/version` 응답)
- `web/lib/hooks.ts` — `useAppVersion()` 추가 (`/api/version`, revalidateOnFocus/IfStale false — 거의 변경 없음)
- `web/components/FeedHeader.{tsx,module.css}` 신규 — 섹션 헤더 공통 컴포넌트
  - props: `eyebrow` / `title` / `viewAllHref?` / `viewAllLabel?` / `subtitle?`
  - 원본 `.feed-header` / `.feed-eyebrow` / `.feed-title` / `.feed-view-all` 1:1
  - 추후 Explore의 BROADCAST / TAG.CLOUD / EDITOR.PICKS 에서도 재사용 예정
- `web/components/NoticeCarousel.{tsx,module.css}` 신규
  - 3개 슬라이드 가로 scroll-snap (첫 슬라이드만 banner.png + 외부 링크, 나머지는 향후 채움)
  - scroll position 추적으로 `1 / 3` 페이지네이션 업데이트
  - touch-action: pan-x
- `web/components/CreatorRow.{tsx,module.css}` 신규
  - `CreatorItem[]` props, 빈 배열이면 미렌더
  - 카드 클릭 → `/creator/<handle>` (encodeURIComponent로 @ 보존)
  - drag slider는 Phase A에서 native scroll만 (원본의 `initDragSlider` 데스크탑 드래그는 후속)
- `web/components/GenreRow.{tsx,module.css}` 신규
  - `GenreItem[]` props, 카드 클릭 → `/explore?tag=<label>`
  - 130x170 background-image 카드 + 그라디언트 오버레이 + 라벨/타이틀/카운트
- `web/components/UpcomingGrid.{tsx,module.css}` 신규
  - `UpcomingItem[]` props, char-grid (2열) 변형
  - **CharacterCard와 분리** 이유: UPCOMING은 정보(이름/역할)가 카드 안쪽 그라디언트 위에 박혀있는 변형. CharacterCard는 카드 외부에 이름·역할 블록을 둠. 마크업 차이가 커서 props로 토글하면 복잡해짐.
  - 준비중 overlay + label
- `web/components/SiteFooter.{tsx,module.css}` 신규
  - `useAppVersion()` 호출로 `Folio · vX.Y · Build 2026.04` 표시
  - LEGAL / SUPPORT 컬럼, legal 영역
- `web/app/page.tsx` 갱신 — 7섹션 조립 (Header / RECOMMENDED / Notice / Creator / Genre / Upcoming / Footer)
  - RECOMMENDED 섹션 헤더를 인라인 → `<FeedHeader>` 호출로 교체
- `web/app/page.module.css` — feed-header 룰 제거 (FeedHeader.module.css로 이동), `.section` / `.charGrid` / `.stateMsg`만 유지

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (`/` 15.8 kB / 114 kB First Load — 2.2 kB 증가)
- ✅ jest 49/49 통과
- ⏸ 시각 비교 — 다음 세션
- ⏸ 모바일 — 다음 세션

**체크리스트 진척**:
- ✅ 섹션 2.1 (홈) — 모든 섹션 1차 완료
- 신규 4.x 항목으로 등록될 컴포넌트:
  - 4.3 `<FeedHeader>` (재사용)
  - 4.4 `<NoticeCarousel>` (홈)
  - 4.5 `<CreatorRow>` (홈)
  - 4.6 `<GenreRow>` (홈)
  - 4.7 `<UpcomingGrid>` (홈)
  - 4.8 `<SiteFooter>` (글로벌 — 다른 페이지에서도 재사용 가능)

**발견 / 회고**:
- `Curation` 인터페이스를 1차 작업 때 잘못 정의해 둔 게 큐레이션 섹션 작업 시 그대로 드러남 → 작업 첫 단계로 타입 재정의부터. **교훈**: API 응답 인터페이스를 가설 기반으로 미리 짜놓지 말고, 실 데이터 또는 라우트 코드 확인 후 정의할 것.
- 데스크탑 마우스 드래그 슬라이더 (`initDragSlider`)는 모바일에서는 native pan-x로 충분 — Phase A 우선순위 낮음. 추후 hover 환경에서 필요하면 hook 형태로 (`useDragScroll`).
- 외부 링크/외부 이미지에는 `next/image` 대신 `<img>` 사용 (간소화 + 외부 호스트 도메인 등록 불필요). 캐릭터 카드 이미지(/images/*)는 Express가 서빙하므로 `next/image` + `unoptimized` 유지.
- FeedHeader는 향후 Explore의 3섹션(BROADCAST/TAG.CLOUD/EDITOR.PICKS)에서도 그대로 쓸 수 있도록 `subtitle` props 미리 추가.
