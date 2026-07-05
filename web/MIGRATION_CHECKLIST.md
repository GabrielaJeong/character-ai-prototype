# React 마이그레이션 마스터 체크리스트

> 모든 화면·컴포넌트·연결·시각·상태 분기를 빠짐없이 추적하는 단일 진실원천.
> 작업 시작 전 / 작업 후 매번 확인. 누락 발견 시 즉시 항목 추가.
> 진행 기록은 `MIGRATION_HISTORY.md` 참조.

---

## 0. 사전 참조 문서 (작업 시작 전 필독)

| 문서 | 작업 시 참조 시점 | 핵심 내용 |
|------|---|---|
| `CLAUDE.md` | 모든 작업 | Red Flags 14종, 코딩 규칙, 절대 금지 |
| `docs/CONVENTIONS.md` | 코드 작성 시 | 함수명 패턴, 디자인 토큰 사용, API 응답 형식 |
| `docs/DESIGN_SYSTEM.md` | UI 컴포넌트 작성 시 | 컬러·타이포·버튼·카드·모달·z-index 1:1 매칭 |
| `docs/LESSONS.md` | 인증·모바일·상태 작업 시 | L-002·L-007·L-010~L-014 특히 중요 |
| `docs/DECISIONS.md` | 기술 결정 시 | D-014(React 전략), D-017(DB) |
| `docs/SECURITY.md` | 인증·세션 작업 시 | 세션 소유권, escape, CSP |
| `docs/PRODUCTION_PLAN.md` | Phase 추적 | Phase A 작업 분해 |
| `docs/CURRENT_STATE.md` | 기능 누락 검증 | 현재 구현된 모든 기능 리스트 |
| `public/index.html` | 화면 마이그레이션 시 | 원본 HTML 구조 (모든 screen-* 참조원) |
| `public/css/style.css` | CSS 이식 시 | 5,200줄 원본, 하이브리드 분리 기준 |
| `public/js/app.js` | 로직 이식 시 | 4,200줄 원본 |

### 참조 시 자동 체크리스트 (매 작업마다)
- [ ] CLAUDE.md의 Red Flags 14종을 작업 영역과 대조했는가?
- [ ] DESIGN_SYSTEM.md의 해당 컴포넌트 섹션 확인했는가?
- [ ] 관련 LESSONS L-XXX가 있는가? (특히 인증·모바일)
- [ ] 원본 HTML/CSS/JS의 해당 부분을 직접 열어봤는가?

---

## 1. CSS 마이그레이션 전략 (확정: 하이브리드 C안)

### `web/app/globals.css`에 들어갈 것
- `:root` 디자인 토큰 (--bg, --accent, --font 등)
- 전역 리셋 (box-sizing, tap-highlight, button touch-action, body min-height: 100dvh)
- `#app` 셸 (max-width 430px, 데스크탑 phone shell)
- `.screen` 공통 (display none/flex)
- (선택) 매우 공통적인 유틸리티 (font 임포트 link는 `<head>`에서 처리)

### CSS Modules로 가는 것
- 각 화면별 스타일 → `app/<route>/page.module.css`
- 각 글로벌 컴포넌트 → `components/<Component>.module.css`
- 각 작은 UI 컴포넌트 → `components/<Component>.module.css`

### 원본 `style.css` 5,200줄 분배 기준
- **globals**: 1~135 (font·tokens·reset·shell·screen·scrollbar)
- **components/BottomNav** + Toast: 510~610 부분
- 각 module: 해당 화면/컴포넌트 클래스 묶음

### 체크포인트
- [ ] globals.css에 토큰 누락 없는가? (원본 1~20행)
- [ ] 각 module에 해당 화면 모든 클래스 이식됐는가?
- [ ] 글로벌 namespace 충돌 없는가? (`.btn-primary` 등 module 내부로만)

---

## 2. 화면 인벤토리 (20개)

각 화면당 다음 6가지 체크 항목:
- [ ] **CSS**: 원본 style.css 해당 섹션 → page.module.css 이식 완료
- [ ] **컴포넌트 분해**: 재사용 가능한 부분 → components/로 분리
- [ ] **백엔드 연결**: 사용하는 모든 API 엔드포인트 호출 확인
- [ ] **상태 분기**: 로그인/성인/데모 등 조건부 렌더링
- [ ] **연결 경로**: 이 화면에서 갈 수 있는 모든 다른 화면 링크
- [ ] **모바일 검증**: L-012 (touch-action manipulation / 44px / :active)

### 2.1 `/` (홈 — screen-landing)
원본 HTML 라인: 32~145 / CSS: 148~470 / JS 로직: `loadCharacters`, `loadCurationSections`, `renderCharacterGrid`

- [ ] CSS 이식
- [ ] 사용 컴포넌트: `<LandingHeader>` (Folio 로고 + ALL/18+ + 알림 벨 + 배지), `<CharacterCard>`, `<NoticeCarousel>` (BROADCAST 배너), `<CreatorRow>` (TOP.creators), `<GenreRow>` (GENRE.catalog), `<FeedSectionHeader>` (eyebrow + title + "VIEW ALL →")
- [ ] API: `GET /api/characters`, `GET /api/curation`, `GET /api/notifications?count` (badge)
- [ ] 상태 분기:
  - [ ] 비로그인: 18+ 토글 클릭 → 인증게이트
  - [ ] 로그인 + 성인인증 X: 18+ → 인증 모달
  - [ ] 로그인 + 성인인증 O + 토글 ON: adult_only 캐릭터 표시
  - [ ] adult_only 캐릭터는 토글 OFF 시 비표시
  - [ ] 알림 미읽음 수 표시 ("9+" 형식)
- [ ] 연결: 캐릭터 카드 → `/character/[id]` / 알림 벨 → `/notification` / 큐레이션 → 적절한 라우트 / "VIEW ALL" → `/explore`
- [ ] 모바일 QA

### 2.2 `/character/[id]` (인트로 — screen-intro)
원본: 167~278 / CSS: 2326~2790 / 가장 큰 화면 중 하나

- [ ] CSS 이식 (intro-wrapper 스크롤 컨테이너 패턴 — L-016 유사 주의)
- [ ] 사용 컴포넌트: `<IntroHero>` (이미지 + 그라디언트 + 플로팅 nav), `<IntroIdentity>` (이름 한/영, role), `<IntroStatsBar>` (CHATS/LIKES), `<IntroCreatorBy>` (`<Link href="/creator/@xxx">`), `<IntroTabs>` (ABOUT/NOTES/COMMENTS), `<SafetySegment>` (Top-right floating)
- [ ] API: `GET /api/characters/:id` 또는 캐릭터 목록 캐시 사용
- [ ] 상태 분기:
  - [ ] 좋아요·북마크: 로그인 필요 (비로그인 시 인증 게이트)
  - [ ] 좋아요·북마크 상태 표시 (UI만 — `loadBookmarks` 참조)
  - [ ] safety segment: rating에 따라 canToggle 결정, adult_only는 토글 비활성
  - [ ] character.rating == 'toggleable' && !adult_content_enabled → safety 강제 ON
  - [ ] adult_only 캐릭터를 비인증 유저가 직접 URL 접근 시? → 404 또는 인증 게이트
- [ ] 연결: 뒤로 → `/` / 좋아요·북마크 → API / 더보기 → toast 안내 / 크리에이터 → `/creator/@username` / "대화 시작" → `openPersonaSetup()` 로직
- [ ] **인트로 스크롤**: intro-wrapper로 hero+content 같이 스크롤, bottom-bar는 flex-shrink:0 (D-017 유사 패턴)
- [ ] 모바일 QA

### 2.3 `/character/[id]/chat` (채팅 — screen-chat) ★ 가장 복잡
원본: 430~440 / CSS: 1683~2280 / JS: `chat`, `regenerate`, 스트리밍 파싱

- [ ] CSS 이식
- [ ] 사용 컴포넌트: `<ChatHeader>` (back + 캐릭터 아바타+이름), `<MessageBubble>` (user / assistant variants), `<TypingIndicator>`, `<ChatInput>` (자동 높이 textarea + send), `<ModelPicker>` (popover), `<NoteBtn>` (note modal 트리거), `<RegenerateBtn>` + pagination
- [ ] API: `POST /api/chat` (스트리밍? body 전체?), `POST /api/chat/regenerate`, `GET /api/sessions/:id`, `GET/PUT /api/sessions/:id/note`, `GET /api/sessions/:id/safety`, `PUT /api/sessions/:id/safety`
- [ ] 상태 분기:
  - [ ] 새 세션 / 기존 세션 분기 (`sessionId` 존재 여부)
  - [ ] 모델 변경 → 즉시 `PUT updateSessionModel`
  - [ ] safety 변경 → `PUT /:id/safety`
  - [ ] 비로그인 게스트 모드 — guestId 자동 생성, 데이터 본인만 보임
  - [ ] 첫 메시지: persona 필수 → 페르소나 화면에서 옴
  - [ ] 응답 중 사용자가 다른 메시지 보내려고 하면? (queueing 또는 disable)
- [ ] 연결: 뒤로 → `/character/[id]` (L-???, 메인 아니라 인트로로) / 헤더 아바타 → `<CharProfileModal>`
- [ ] 스트리밍: 현재 vanilla는 fetch + ReadableStream 파싱하는지, 일반 fetch인지 확인 필요 → 구현 방식 결정
- [ ] 재생성 + 페이지네이션: bubble._versions 배열로 관리 (vanilla 패턴 React화)
- [ ] 모바일 QA (자동 스크롤, 키보드 열림 시 입력창 위치)

### 2.4 `/persona` (페르소나 엔트리)
원본: 286~370 / JS: `openPersonaSetup`, `_routePersonaLinked`

- [ ] `/persona` URL은 표시되지 않음 — 페르소나 유무로 `/persona/select` 또는 `/persona/new`로 replaceState (L-011 패턴)

### 2.5 `/persona/new` (페르소나 신규 — screen-persona)
- [ ] CSS 이식
- [ ] 컴포넌트: `<PersonaForm>` (이름·나이·외형·성격·노트 + 성별 버튼 + 아바타 업로드 + 추천 채우기 버튼)
- [ ] API: `POST /api/personas`
- [ ] 상태 분기:
  - [ ] currentCharacter 있으면 **linked 모드** (subtitle에 캐릭터명, "대화 시작" 버튼, recommend 버튼 표시)
  - [ ] currentCharacter 없으면 **standalone 모드** (마이페이지에서 진입, "저장하기" 버튼, recommend 숨김)
- [ ] 연결: 뒤로 → `personaGoBack()` (linked → 캐릭터 인트로, standalone → /mypage) / 저장 후 → linked는 채팅 시작, standalone은 /mypage

### 2.6 `/persona/select` (페르소나 선택 — screen-persona-select)
- [ ] CSS 이식
- [ ] 컴포넌트: `<PersonaCard>` (그리드, default 배지), `<NewPersonaCTA>` (마지막 카드)
- [ ] API: `GET /api/personas`
- [ ] 상태 분기: 비로그인이면 `/persona/new` 리다이렉트
- [ ] 연결: 카드 → `/persona/select/[id]` / 새 페르소나 카드 → `/persona/new` / 뒤로 → 캐릭터 인트로

### 2.7 `/persona/select/[id]` (선택 후 편집 — screen-persona-select-edit)
- [ ] 페르소나 데이터 미리 채워진 폼
- [ ] 컴포넌트: `<PersonaForm>` 재사용 (read mode가 아닌 prefilled)
- [ ] 저장 → 채팅 시작

### 2.8 `/persona/[id]` (페르소나 상세 — screen-persona-detail)
- [ ] 마이페이지에서 진입
- [ ] 외형·성격·특이사항 프로필 뷰
- [ ] 삭제 / 기본 설정 액션

### 2.9 `/history` (대화 목록 — screen-history)
원본: 133~165 / JS: `loadHistory`, 복수 선택 삭제

- [ ] CSS 이식
- [ ] 컴포넌트: `<HistoryHeader>` (탭 헤더 + 편집 모드 토글), `<SessionCard>` (아바타·이름·페르소나·safety pennant·last message), `<SelectMode>` (체크박스 + bulk delete)
- [ ] API: `GET /api/sessions`, `DELETE /api/sessions/:id` 또는 bulk
- [ ] 상태 분기:
  - [ ] 비로그인 → `/api/sessions`는 guest_id 기반 본인 게스트 세션만
  - [ ] 로그인 → user_id 기반 본인 세션
  - [ ] 0개 → empty 메시지
- [ ] 연결: 세션 카드 → 해당 캐릭터 채팅 재개 / 편집 → 선택 → 삭제 confirm modal

### 2.10 `/explore` (탐색 — screen-explore)
원본: 47~131 / CSS: 156~470 / JS: `_routeExplore`, `_applyExploreFilter`

- [ ] CSS 이식
- [ ] 컴포넌트: `<TagBar>` (`#ALL` + 다중 선택 chip + 한국어 검색 초성), `<SearchInput>`, `<NoticeCarousel>` (BROADCAST 배너), `<TagCloud>` (TAG.CLOUD), `<EditorPicks>` (EDITOR.PICKS), `<CreatorRow>` (TOP.creators 플레이스홀더), `<GenreRow>` (GENRE.catalog 플레이스홀더), 필터링된 캐릭터 그리드
- [ ] API: `GET /api/characters`, `GET /api/curation`
- [ ] 상태 분기:
  - [ ] 큐레이션 / 랭킹 탭
  - [ ] 태그 다중 선택은 AND 필터
  - [ ] adult content 토글 별도 (탐색 페이지 — 아님? 홈만? 원본 확인 필요)
- [ ] 연결: 카드 → `/character/[id]` / 큐레이션 → 적절한 라우트

### 2.11 `/notification` (알림함 — screen-notification)
원본: 814~843 / CSS: 3247~3496 / JS: `loadNotifications`, `loadNotifBadge`

- [ ] CSS 이식
- [ ] 컴포넌트: `<NotifHeader>` (back + 알림함 + 미읽음 수 + MARK ALL), `<NotifTabs>` (ALL/SOCIAL/SYSTEM/NOTICE), `<NotifGroup>` (날짜 그룹), `<NotifRow>` (아이콘 + 제목 + 시간 + 카테고리 배지, NOTICE는 5줄 클램프 + 더보기)
- [ ] API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- [ ] 상태 분기: 비로그인 → 인증 게이트 / 미읽음 강조 (notif-row-recent)
- [ ] 연결: 뒤로 → 이전 / row 클릭 → 읽음 처리

### 2.12 `/mypage` (마이페이지 — screen-mypage)
원본: 1014~1167 / CSS: 3550~3850 / JS: `loadMypage`, `loadMypagePersonas`, `loadMypageChars`, `loadMypageBookmarks`

- [ ] CSS 이식
- [ ] 컴포넌트: `<MypageProfileCard>` (사각 아바타 + 닉네임·@id·이메일 + CREATOR 배지), `<MypageRow>` (메뉴 row 공통), `<MypageTabBar>` (페르소나·캐릭터·책갈피), `<MyPersonaCard>` `<MyCharCard>` `<MyBookmarkCard>` (각 탭 컨텐츠), `<RevenueCard>` (BETA 플레이스홀더), `<MypageModal>` (정보 수정 / 비번 변경)
- [ ] API: `GET /api/auth/me`, `PATCH /api/auth/me`, `DELETE /api/auth/me`, `GET /api/personas`, `GET /api/characters` (mine filter), `GET /api/bookmarks`, `GET /api/version`
- [ ] 상태 분기:
  - [ ] 비로그인 → 인증 게이트 (intendedPath /mypage)
  - [ ] username 있을 때만 "크리에이터 프로필" 메뉴 row 표시
  - [ ] role === 'admin'일 때만 "어드민 대시보드" 메뉴 row 표시
  - [ ] 성인 인증 토글 / 콘텐츠 ON-OFF 토글 row
- [ ] 연결: 정보 수정 → MypageModal / 새 페르소나 → `/persona/new` / 캐릭터 편집·삭제 / 크리에이터 → `/creator/@xxx` / 어드민 → `/admin` (외부) / 로그아웃 → LogoutModal / 탈퇴 → DeleteAccount modal

### 2.13 `/creator/@[username]` (크리에이터 — screen-creator)
원본: 1203~1250 / CSS: 5025~5200

- [ ] CSS 이식
- [ ] 컴포넌트: `<CreatorHeader>` (아바타 + 닉네임 + @id + 통계), `<CreatorCharGrid>` (작품 목록), `<CreatorCharCard>` (핀 고정 표시)
- [ ] API: `GET /api/creator/:username`, `PATCH /api/creator/:charId/pin` (owner 전용)
- [ ] 상태 분기: 본인 프로필 → "프로필 편집" 버튼 + 핀 고정 기능
- [ ] 연결: 캐릭터 카드 → `/character/[id]`

### 2.14 `/builder` (빌더 진입 — screen-builder)
원본: 446~493 / JS: `openBuilder`

- [ ] CSS 이식
- [ ] 컴포넌트: `<SelectCard>` (AI 빌더 / 직접 작성 2개)
- [ ] 상태 분기: 비로그인 → 인증 게이트 (intendedPath /builder)
- [ ] 연결: AI 빌더 → `/builder/chat` / 직접 → `/builder/manual`

### 2.15 `/builder/chat` (AI 빌더 — screen-builder-chat)
원본: 495~536 / JS: `openBuilderChat`, `initBuilderConversation`, `builderSend`, `extractCharReady`, `handleCharacterReady`

- [ ] CSS 이식
- [ ] 컴포넌트: 채팅 헤더(`<ChatHeader>` variant), `<BuilderMessages>` (사용자/어시 메시지), `<BuilderInput>`, `<ModelPicker>` (builder model), `<GenerateBtn>` (CHARACTER_READY 감지 시 자동 부착)
- [ ] API: `POST /api/builder/chat`, `POST /api/builder/generate` (생성 단계)
- [ ] 상태 분기:
  - [ ] 초기화 1회 자동 재시도 (콜드 스타트 대비)
  - [ ] CHARACTER_READY 블록 파싱 → 표시는 cleanBuilderReply로 제거
- [ ] 연결: 생성 → `/builder/loading` → `/builder/preview` / 뒤로 → `/builder`

### 2.16 `/builder/manual` (직접 작성 — screen-builder-manual)
원본: 537~630 / JS: `openBuilderManual`, `registerManualCharacter`, `_generateManualSystemPrompt`

- [ ] CSS 이식
- [ ] 컴포넌트: `<ManualForm>` (이름·직업·나이·소개·외형·성격·말투·예시·배경·세계관·관계 11필드 + 태그 + 등급 + 아바타)
- [ ] 필수 필드 검증: 이름·성격·말투·태그(1+)
- [ ] API: `POST /api/characters/create`
- [ ] 연결: 등록 후 → 홈

### 2.17 `/builder/loading` (로딩 — screen-builder-loading)
- [ ] 진행 바 컴포넌트
- [ ] 라우트로 두지 않고 inline state로 가능 (단순)

### 2.18 `/builder/preview` (편집/등록 — screen-builder-edit)
- [ ] CSS 이식
- [ ] 컴포넌트: AI 생성 결과 미리보기 + 편집 + 등록
- [ ] API: `POST /api/characters/create`

### 2.19 `/login` `/signup` `/reset-password` (인증)
- [ ] 모두 별도 라우트 (이미 시도했으나 rewind됨, 다시 구현)
- [ ] `<LoginForm>` `<SignupForm>` `<ResetPasswordForm>` 분리
- [ ] redirect 쿼리 보존
- [ ] L-011 인증 게이트 루프 방지: replaceState로 history 누적 차단

### 2.20 `not-found` (404)
- [ ] 검색 아이콘 + "페이지를 찾을 수 없어요" + 뒤로/홈 버튼
- [ ] `app/not-found.tsx`로 자동 처리 + 라우트 핸들러에서 명시적 404 호출 시 `notFound()` 사용

---

## 3. 글로벌 컴포넌트 인벤토리 (12개)

각 컴포넌트마다:
- [ ] CSS module 작성
- [ ] DESIGN_SYSTEM.md 해당 섹션 1:1 일치
- [ ] z-index 정합성 (100/200/300/9998/9999 계층)

### 3.1 `<Splash>` (z 9999)
- [ ] 세션당 1회 (sessionStorage `folio-splash-shown`)
- [ ] 800ms + fadeOut 0.4s
- [ ] Foli + o(점) 디자인 로고

### 3.2 `<BottomNav>` (z 200)
- [ ] 5탭 + 아이콘 (⊞ ◷ ◎ ✦ ◉)
- [ ] HIDE_PATTERNS (채팅·빌더·로그인·알림 등에서 자동 숨김)
- [ ] active 판정 (pathname startsWith)
- [ ] `safe-area-inset-bottom`

### 3.3 `<Toast>` (z 9998)
- [ ] showToast(message, duration?) — Zustand store
- [ ] auto-dismiss 타이머, pointer-events: none

### 3.4 `<AuthGate>` (z 300)
- [ ] `showAuthGate(title, desc, intendedPath)` Zustand
- [ ] "로그인하기" → `replaceState('/login?redirect=...')` (L-011)
- [ ] DEMO_MODE 활성 시 "체험하기" 버튼 노출
- [ ] 외부 클릭으로 닫기 + 내부 클릭 stopPropagation

### 3.5 `<LogoutModal>`
- [ ] 확인 / 취소
- [ ] 확인 시 `POST /api/auth/logout` → 상태 초기화 → 홈

### 3.6 `<DeleteConfirmModal>` (재사용)
- [ ] props: title, desc, onConfirm, variant
- [ ] 세션 삭제·페르소나 삭제·캐릭터 삭제·계정 탈퇴 모두 재사용

### 3.7 `<NoteModal>` (z 100)
- [ ] 채팅 노트 — 1000자 제한
- [ ] `GET/PUT /api/sessions/:id/note`

### 3.8 `<CharProfileModal>` (z 200, position absolute — chat 내부)
- [ ] 채팅 헤더 아바타 클릭 → 프로필 슬라이드업
- [ ] 닫기 애니메이션 (slideDown)

### 3.9 `<AdultVerifyModal>` (z 300)
- [ ] 첫 성인 인증 — 체크박스 + 확인
- [ ] `POST /api/auth/adult-verify`

### 3.10 `<ModelPicker>` (z 9999, position fixed)
- [ ] 채팅 / 빌더 각각 인스턴스
- [ ] 외부 클릭으로 닫기 (document click listener)

### 3.11 `<DemoBanner>` (z 210)
- [ ] DEMO_MODE && user.isDemo 일 때 표시
- [ ] "체험 종료" → logout

### 3.12 `<MypageModal>` (정보 수정 / 비번 변경)
- [ ] 닉네임·이메일·@아이디·비번 변경
- [ ] `PATCH /api/auth/me`

---

## 4. 재사용 UI 컴포넌트 인벤토리 (~16개)

| # | 컴포넌트 | 사용처 | 비고 |
|---|---|---|---|
| 1 | `<CharacterCard>` | 홈·탐색·마이페이지·크리에이터 | numberBadge, statusBadge, 태그, stat |
| 2 | `<SessionCard>` | history | 선택 모드 체크박스 지원 |
| 3 | `<SelectCard>` | 빌더 진입, 페르소나 옵션 | 아이콘·타이틀·설명·화살표 |
| 4 | `<CreatorRowItem>` | 탐색 TOP.creators | 원형 아바타 |
| 5 | `<GenreCard>` | 탐색 GENRE.catalog | 배경 이미지 + 오버레이 |
| 6 | `<TagChip>` | 탐색 (선택 가능), 카드 (read-only) | 활성 토글 + active 색 |
| 7 | `<FormGroup>` | 인증·페르소나·빌더·마이페이지 | label + input + error |
| 8 | `<ToggleSwitch>` | 마이페이지·세팅 | 26x44 thumb |
| 9 | `<SafetySegment>` | 인트로·채팅 헤더 | 🔒전연령/🔞성인 + canToggle |
| 10 | `<AdultSegment>` | 홈 헤더 | ALL/18+ |
| 11 | `<BtnPrimary> <BtnGhost> <BtnBack> <BtnIcon> <BtnSend> <BtnDeleteConfirm>` | 전역 | 각각 다른 폴리시 |
| 12 | `<StatusBadge>` | 캐릭터 카드 | NEW/HOT/UP + label-translate |
| 13 | `<ContentHeader>` | 여러 화면 | eyebrow + title + desc |
| 14 | `<TabBar>` | 마이페이지·인트로 | underline tab pattern |
| 15 | `<TypingIndicator>` | 채팅·빌더 채팅 | 3 dot animation |
| 16 | `<EmptyState>` | history·mypage tabs·bookmarks | 공통 빈 상태 메시지 |

---

## 5. 백엔드 API 엔드포인트 매트릭스

| 메서드 | 경로 | 사용 화면 | 인증 필요 | rate-limit |
|---|---|---|---|---|
| GET | `/api/version` | 마이페이지·푸터 | - | api |
| GET | `/api/curation` | 홈·탐색 | - | api |
| GET | `/api/characters` | 홈·탐색·마이페이지·크리에이터 | - | api |
| POST | `/api/characters/create` | 빌더(직접/AI) | ✓ | api |
| GET | `/api/characters/:id` (있다면) | 인트로 | - | api |
| POST | `/api/chat` | 채팅 | guest OK (소유권) | api |
| POST | `/api/chat/regenerate` | 채팅 재생성 | guest OK | api |
| GET | `/api/sessions` | 대화 목록 | guest OK | api |
| GET | `/api/sessions/:id` | 채팅 진입 | 소유권 검증 | api |
| PUT | `/api/sessions/:id/safety` | 채팅 safety | 소유권 | api |
| GET | `/api/sessions/:id/note` | 노트 모달 | 소유권 | api |
| PUT | `/api/sessions/:id/note` | 노트 저장 | 소유권 | api |
| GET | `/api/personas` | 마이페이지·선택 | ✓ | api |
| POST | `/api/personas` | 페르소나 생성 | ✓ | api |
| PATCH | `/api/personas/:id` | 페르소나 수정 | ✓ | api |
| DELETE | `/api/personas/:id` | 페르소나 삭제 | ✓ | api |
| GET | `/api/bookmarks` | 마이페이지 | ✓ | api |
| POST | `/api/bookmarks` | 인트로 책갈피 | ✓ | api |
| DELETE | `/api/bookmarks/:charId` | 인트로 해제 | ✓ | api |
| GET | `/api/notifications` | 알림함·홈 배지 | ✓ | api |
| PATCH | `/api/notifications/:id/read` | 알림 row 클릭 | ✓ | api |
| PATCH | `/api/notifications/read-all` | MARK ALL | ✓ | api |
| GET | `/api/creator/:username` | 크리에이터 | - | api |
| PATCH | `/api/creator/:charId/pin` | 본인 캐릭터 핀 | ✓ (owner) | api |
| POST | `/api/builder/chat` | AI 빌더 채팅 | ✓ | api |
| POST | `/api/builder/generate` | 시스템 프롬프트 생성 | ✓ | api |
| GET | `/api/auth/me` | initAuth | - | api |
| PATCH | `/api/auth/me` | 정보 수정 | ✓ | api |
| DELETE | `/api/auth/me` | 탈퇴 | ✓ | api |
| POST | `/api/auth/login` | 로그인 | - | auth (10) |
| POST | `/api/auth/register` | 회원가입 | - | auth (10) |
| POST | `/api/auth/logout` | 로그아웃 | - | api |
| GET | `/api/auth/check-username` | 회원가입 실시간 | - | checkUsername (30) |
| POST | `/api/auth/forgot-password` | 재설정 요청 | - | api |
| POST | `/api/auth/reset-password` | 토큰으로 변경 | - | api |
| PATCH | `/api/auth/adult-content` | ALL/18+ 토글 | ✓ | api |
| POST | `/api/auth/adult-verify` | 첫 성인 인증 | ✓ | api |
| GET | `/api/auth/demo-available` | 데모 버튼 표시 여부 | - | api |
| POST | `/api/auth/demo-login` | 데모 로그인 | - | api |

### 체크포인트
- [ ] 각 API 호출 시 `credentials: 'include'` 적용 (lib/api.ts)
- [ ] 401 응답 시 적절한 처리 (인증 게이트 또는 리다이렉트)
- [ ] 한국어 에러 메시지 toast 표시
- [ ] SWR 사용 적합 vs 직접 fetch 판단

---

## 6. 상태 분기 매트릭스

| 상태 | 영향 받는 화면 |
|------|------|
| `user === null` (게스트) | 거의 모든 화면 — 게이트 표시 / 게스트 모드 활성 |
| `user.adult_content_enabled` | 홈·탐색 (adult_only 캐릭터 표시) |
| `user.adult_verified` | 18+ 토글 시 인증 모달 분기 |
| `user.role === 'admin'` | 마이페이지 (어드민 메뉴 표시) |
| `user.isDemo` | 모든 화면 (DemoBanner 표시) |
| `user.username` | 마이페이지 (크리에이터 메뉴) |
| `DEMO_MODE` env (서버에서 받음) | AuthGate (체험 버튼 노출) |
| `session.safety` | 채팅·인트로 (safety segment) |
| `currentCharacter` | 페르소나 화면 분기 (linked/standalone) |
| 페르소나 개수 | /persona → /persona/new vs /persona/select |
| `sessionId` 보유 여부 | 채팅 신규/기존 분기 |
| URL `?redirect=` 파라미터 | 로그인·회원가입 후 destination |

---

## 7. 인증 / 라우팅 학습 체크 (L-011, L-017)

- [ ] **L-011 인증 게이트 루프 방지**: gated 화면(`/mypage`, `/history` 등) URL이 history에 누적되지 않도록 게이트 시 `replaceState('/')` 후 모달 표시
- [ ] **인증 게이트 후 로그인 흐름**: `goToLogin` → `replaceState('/login?redirect=...')` 그래야 뒤로가기 시 게이트 재발동 안 됨
- [ ] **redirect 쿼리 보존**: 로그인 ↔ 회원가입 ↔ 비번찾기 탭 전환 시 쿼리 파라미터 보존
- [ ] **모든 `showAuthGate()` 호출 시 intendedPath 전달**: 빠지면 로그인 후 메인으로 fallback됨 (실제로 빠뜨렸던 버그)

---

## 8. 모바일 / 인터랙션 학습 체크 (L-012)

각 인터랙티브 요소마다:
- [ ] `button` / `a` 가 아닌 div/span에 onClick → `touch-action: manipulation` 명시
- [ ] 최소 터치 타겟 44×44px (시각 작아도 padding 또는 `::before` 가상요소로 확장)
- [ ] `:hover`만 있고 `:active` 없으면 안 됨 — `:active { opacity: 0.65 }`
- [ ] 가로 스크롤 컨테이너: `overflow-x: auto`, `-webkit-overflow-scrolling: touch`, `touch-action: pan-x`
- [ ] 입력창 `font-size: 16px` 이상 (iOS 자동 줌인 방지) — `@supports (-webkit-touch-callout: none)`
- [ ] 100vh 사용 금지 — `100dvh` (iOS Safari 주소창 대응)

---

## 9. CHANGELOG / 보안 / 데이터 학습 체크

- [ ] **L-002**: 캐릭터 config/source drift 방지 — system.md와 config.json 동기
- [ ] **L-007**: React는 기본 escape됨. 다만 `dangerouslySetInnerHTML` 사용 시 escape 명시
- [ ] **L-010**: 세션 소유권 — `verifyOwnership`이 백엔드에서 처리. React는 401/403 적절히 처리
- [ ] **L-013**: production 환경변수 검증 — `NEXT_PUBLIC_API_URL` 등 누락 검증
- [ ] **L-014**: 시크릿 echo 금지 — API 키 등 로그·문서·UI 출력 금지

---

## 10. Pre-Cutover 종료 조건

Phase A를 종료 선언하기 위한 모든 조건:

- [ ] 위 20개 화면 모두 ✅
- [ ] 위 12개 글로벌 컴포넌트 모두 ✅
- [ ] 위 16개 재사용 컴포넌트 모두 ✅
- [ ] 모든 API 엔드포인트 호출 가능 + 적절한 에러 처리
- [ ] 모든 상태 분기 동작 확인
- [ ] L-011 / L-012 / L-017 패턴 적용
- [ ] 모바일 (iOS Safari) 핵심 플로우 수동 테스트
- [ ] 데모 모드 전체 플로우 동작
- [ ] 빌드 통과 + 타입 체크 통과 + lint 통과
- [ ] Vercel 배포 후 1주일 안정 운영 (백엔드는 Railway 그대로)
- [ ] LESSONS / DECISIONS에 React 마이그레이션 학습 기록

---

## 부록: 매 작업 시작 시 자동 체크

작업 시작할 때마다 이 5가지를 자체 검증:

1. **참조 문서 열어봤나?** — CLAUDE.md / DESIGN_SYSTEM.md / 관련 LESSONS
2. **원본 코드 봤나?** — index.html / style.css / app.js의 해당 부분
3. **체크리스트 항목 명확한가?** — 이 화면/컴포넌트의 모든 ✅ 항목 파악
4. **상태 분기 빠짐없나?** — 로그인 / 성인 / 데모 / safety 등 매트릭스 대조
5. **연결 경로 매핑됐나?** — 이 화면에서 갈 수 있는 모든 다른 화면 + redirect 흐름

---

## 부록: 매 작업 종료 시 자동 체크

1. **프론트 빌드 + 타입 체크 통과** (`cd web && npm run type-check && npm run build`)
2. **백엔드 테스트 통과** (`cd .. && npx jest`) — 49개 + 마이그레이션 중 추가될 테스트
3. **시각 비교** — 원본 스크린샷 또는 vanilla 화면과 1:1 대조
4. **모바일 체크리스트 적용 확인** (L-012 3종)
5. **연결 경로 확인** — 만든 화면의 모든 outgoing link 동작
6. **MIGRATION_HISTORY.md에 기록**
7. **체크리스트의 해당 ✅ 항목 마킹**
