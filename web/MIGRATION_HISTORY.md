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

## Learned — 마이그레이션 중 누적되는 교훈

> 작업하다 같은 실수·문제가 반복 가능하다고 판단되면 여기 ML-XXX로 등재.
> docs/LESSONS.md의 L-XXX (프로덕션 전반)와 별개 — 여긴 마이그레이션 작업 한정.
> 새 ML 추가 시 "출처" 날짜·Day와 함께, 작업 시작 전 이 섹션 훑어보고 동일 함정 회피.

### ML-001 — globals.css의 `@import`는 Next.js dev에서 stylesheet 로드 체인을 깬다
- **증상**: 페이지 렌더 시 다크 테마·스타일 전체 깨짐 (plain white 배경, 폰트 미적용)
- **원인**: `@import url('pretendard.css')`가 Next.js dev 모드에서 stylesheet 로드를 차단하는 케이스
- **예방**: 외부 폰트는 `layout.tsx`의 `<head>`에 `<link>` 태그로 로드. globals.css에 `@import` 금지.
- **출처**: rewind 전 첫 시도 (2026-05-05)

### ML-002 — API 응답 shape를 가설로 짜놓지 말 것
- **증상**:
  - Curation 인터페이스 필드명 (banners/editorPicks/topCreators...) 이 실제 (broadcast/collections/creators...) 와 불일치 → 컴파일은 통과해도 런타임에 데이터 누락
  - `notifications.filter is not a function` — 응답이 `{ items, unreadCount }` 인데 array로 가정
- **원인**: types.ts에 응답 인터페이스를 추측으로 정의. backend 라우트 핸들러를 안 보고 작성.
- **예방**: SWR 훅 / 응답 타입 작성 전에 반드시 해당 `routes/*.js`의 `res.json(...)` 줄을 먼저 grep으로 확인. JSON 데이터 파일도 직접 열어볼 것.
- **출처**: Day 3 (Curation), Day 3.x fix (notifications) (2026-05-27)

### ML-003 — `next build` 직후 `next dev`로 전환 시 `.next` 폴더 충돌
- **증상**: `Error: Cannot find module './XXX.js'` (webpack-runtime), 페이지 렌더 실패
- **원인**: production chunk와 dev chunk가 같은 `.next` 폴더 공유. webpack runtime이 잘못된 chunk hash를 참조.
- **예방**: build로 검증한 직후엔 dev 띄우기 전에 `.next` 삭제.
  ```powershell
  Remove-Item -Recurse -Force web\.next
  npm run dev
  ```
  매번 검증 후 자동화하려면 package.json에 `"clean": "rimraf .next"` 추가 검토.
- **출처**: Day 3.x 종료 후 (2026-05-27)

### ML-004 — Next.js 14에서 `useSearchParams`는 **반드시 Suspense boundary**로 감싸야 함
- **증상**: build 시 prerender 에러 ("useSearchParams() should be wrapped in a suspense boundary")
- **원인**: `useSearchParams`는 client-side hook. App Router 빌드 시 정적 생성과 호환 안 됨.
- **잘못된 시도**: `export const dynamic = 'force-dynamic'` 만으로는 **해결 안 됨**. 정적 생성을 비활성해도 prerender 에러는 그대로 (Day 5 재발 시 확인).
- **올바른 해법**: 페이지를 outer + inner 두 컴포넌트로 분리, outer가 `<Suspense fallback={null}>`로 inner를 감쌈. inner에서만 `useSearchParams` 호출.
  ```tsx
  export default function MyPage() {
    return <Suspense fallback={null}><MyPageInner /></Suspense>;
  }
  function MyPageInner() {
    const sp = useSearchParams();
    // ...
  }
  ```
- **출처**: 초기 시도 (rewind 전), Day 5 재발 (2026-05-27)

### ML-005 — Express(3000)와 Next.js dev(default 3000) 포트 충돌
- **증상**: dev 서버 안 열림 ("address already in use")
- **원인**: 둘 다 기본 포트 3000. 한쪽이 먼저 잡으면 나머지 못 띄움.
- **예방**: package.json `"dev": "next dev -p 3001"`로 Next.js를 3001로 고정. next.config.mjs의 rewrites가 `/api/*` → `localhost:3000`으로 프록시.
- **출처**: Day 0 (2026-05-05)

### ML-006 — App Router는 `error.tsx` / `not-found.tsx` 가 반드시 있어야 함
- **증상**: dev에서 `missing required error components, refreshing...` 메시지가 계속 뜸. 에러 발생 시 폴백 화면 없음.
- **원인**: Next.js 14 App Router는 각 segment에서 에러 boundary와 404 폴백 컴포넌트를 명시적으로 요구. 없으면 dev가 자동 주입 시도하면서 새로고침 반복.
- **예방**: `app/error.tsx` (반드시 `'use client'`, props로 `{ error, reset }`)와 `app/not-found.tsx` 둘 다 layout과 같은 레벨에 둘 것. layout 자체가 throw할 가능성 있으면 `app/global-error.tsx`도 추가.
- **출처**: Day 3.x fix (2026-05-27)

### ML-007 — Express의 정적 자원 경로도 모두 next.config.mjs rewrites에 등록
- **증상**: 캐릭터 이미지 / 배너 이미지가 다 깨져서 alt 텍스트만 표시. 콘솔에 `/images/ihwa.png 404`.
- **원인**: `/api/*`만 프록시하고 있었음. Express는 `app.use(express.static(path.join(__dirname, 'public')))` (server.js:137)로 public/ 전체 (`/images/*`, `/icons/*`, `/uploads/*`)를 서빙. Next.js dev(3001)에서 직접 요청되면 라우트 없어서 404.
- **예방**: next.config.mjs의 `rewrites`에 Express가 서빙하는 모든 정적 경로를 등록. 새 자원 폴더 추가 시 함께 추가. 프로덕션은 NEXT_PUBLIC_API_URL 또는 reverse proxy로 같은 origin 처리.
  ```js
  { source: '/images/:path*',  destination: 'http://localhost:3000/images/:path*' },
  { source: '/icons/:path*',   destination: 'http://localhost:3000/icons/:path*' },
  { source: '/uploads/:path*', destination: 'http://localhost:3000/uploads/:path*' },
  ```
- **부수 정보**: next.config.mjs 변경은 hot-reload 안 됨 → dev 서버 재시작 필수.
- **출처**: Day 3.x fix (2026-05-27)

### ML-008 — `#app` 안에 BottomNav를 함께 두려면 children을 별도 스크롤 컨테이너로 감싸야 함
- **증상**: BottomNav가 viewport 하단에 안 보임. 페이지 콘텐츠 가장 아래로 스크롤해야 그제서야 나타남.
- **원인**: `#app`이 `display:flex; flex-direction:column; overflow:hidden` 인데, `children`이 직접 자식이라 자체 스크롤 없이 flex 늘어남 → BottomNav는 sibling으로 콘텐츠 *뒤*에 밀려나 viewport 밖.
- **예방**: layout.tsx에서 `{children}`을 `<main className="screen-host">`로 감쌀 것. `.screen-host { flex:1; min-height:0; overflow-y:auto; }`로 viewport 내부에서만 스크롤. BottomNav는 sibling이라 하단 고정.
- **원본 대응**: 원본 index.html의 `.screen` 패턴과 동일 — 각 screen이 자체 `flex:1; overflow-y:auto`를 가졌고, BottomNav는 sibling.
- **출처**: Day 3.x fix (2026-05-27)

### ML-009 — Splash dismiss는 **timer + 데이터 ready 동시 만족**을 기다려야 함 (원본 SPA 원칙)
- **증상**: Splash 컴포넌트가 마운트 전이라 home 페이지 콘텐츠가 잠깐 보이고 나서 splash가 덮어쓰임 (FOUC).
- **시도와 실패**:
  1. **1차 (실패)**: `'use client'` + `useEffect`에서 `setVisible(true)` — hydration 후에야 표시 → 첫 페인트에 home 노출
  2. **2차 (실패)**: `useState(true)`로 SSR HTML에 마크업 포함 — 하지만 dev 모드에서 CSS Module 로드 지연 시 `position:fixed`가 적용 전이라 인라인 흐름에 렌더되어 home이 비침
  3. **3차 (실패)**: `<head>`에 `<script dangerouslySetInnerHTML>`로 sessionStorage 체크 → `<html>`에 클래스 부여, CSS로 returning user 즉시 숨김. **부작용**: React 트리 밖 DOM 조작이라 hydration이 `removeChild` 시도 시 null parent 만나 `TypeError: Cannot read properties of null (reading 'removeChild')` 발생. `suppressHydrationWarning`으로 경고는 억제되나 런타임 에러는 못 막음.
- **4차 (실패)**: Splash를 Server Component로 + 인접 `<script>`로 vanilla JS dismiss. **부작용**: SSR HTML이 React 트리에 포함된 채 dismiss script가 hydration 전에 splash 요소 제거 → React가 트리/DOM mismatch 발견 → "Hydration failed because the initial UI does not match what was rendered on the server" 폭주. React 트리 안 요소를 hydration 전 DOM 조작은 어떤 방식으로든 위험.
- **4차 (실패)**: Server Component + 인접 `<script>`로 vanilla JS dismiss → hydration 전 DOM 제거로 mismatch 폭주
- **5차 (실패)**: Client Component + `useState(true)` + timer만으로 dismiss → splash 사라진 뒤 SWR이 데이터 받아오느라 home placeholder "불러오는 중..." → 캐릭터 grid 깜빡임. 재방문자는 0.1~0.3초 안에 splash + 로딩 placeholder + 완성 grid를 빠르게 후루룩 보게 됨.
- **핵심 진단 (사용자 지적)**: "스플래시 전에 홈 화면이 보인다"는 표면 증상이고, 진짜 문제는 **splash 뒤에서 데이터 로딩이 끝나야 splash가 사라져야** 한다는 것. 그래야 splash 사라질 때 home이 이미 완전 로드 상태.
- **원본 SPA의 실제 패턴** (app.js L159~186):
  ```js
  let _dataReady = false, _timerReady = false;
  function _tryDismissSplash() {
    if (_splashDone || !_dataReady || !_timerReady) return;
    // 둘 다 true일 때만 dismiss
  }
  // DOMContentLoaded: 첫방문 setTimeout 800ms → _timerReady=true
  // loadCharacters() 끝: _dataReady=true; _tryDismissSplash()
  ```
- **최종 해법 (Client Component + state + appReady gating)**:
  1. **Zustand store(`useUIStore`)에 `appReady: boolean` + `setAppReady` 추가** — 글로벌 ready 신호
  2. 홈 페이지의 useEffect가 `!isLoading` 되면 `setAppReady(true)` 호출 (원본 _dataReady에 대응)
  3. Splash는 `(timerReady && appReady)` 둘 다 만족할 때만 `setFadeOut(true)`
     · 첫 방문자: `minTimer = 800ms` 후 timerReady=true
     · 재방문자: `minTimer = 0` 후 timerReady=true (sessionStorage 'folio-splash-shown' 체크)
     · **안전망**: `maxTimer = 5000ms` — appReady 신호 안 와도 강제 진행
  4. SSR HTML에 splash 마크업 포함 (`useState(true)`), critical positioning은 inline style → 첫 페인트부터 가림
  5. dismiss는 React state로만 (`setMounted(false)`) — DOM 직접 조작 금지, hydration 안전
  6. fadeOut 완료는 `onAnimationEnd`로 감지하여 unmount → React lifecycle 안
- **결과**: 재방문자도 splash가 데이터 로딩 끝날 때까지 화면 가려서, splash 사라지자마자 home이 완성된 상태로 노출. "후루룩" 깜빡임 차단.
- **원칙**:
  - 첫 페인트에 SSR 데이터가 없는 SWR 기반 페이지의 경우, **splash는 데이터 ready 신호까지 기다려야** 함
  - `<store>.appReady`를 다른 entry page에서도 setAppReady(true) 호출하면 마찬가지 효과
  - SSR HTML이 React 트리에 포함된 요소는 hydration 완료 후에만 DOM 조작 가능 (setState로만)
  - inline script로 React 관리 요소 조작 절대 금지 (`<html>` 클래스, 자식 제거 등)
  - critical 시각 속성은 inline `style={{}}` — CSS 로드/hydration 타이밍 모두에 안전
- **6차 (실제 원인 발견)**: 위 모든 작업에도 사용자가 "여전히 home이 먼저 보이고 splash가 그 다음에 로딩되는 것처럼 보임" 호소. 원인: **Splash.module.css의 `.splash`에 `animation: fadeIn 0.3s ease` 가 들어있어서** opacity 0→1로 페이드인. 첫 0.3초 동안 splash가 반투명이라 home이 비쳐 보임. 원본 style.css의 `#splash`엔 fadeIn 없음 (로고·카피만 fadeIn). 마이그레이션 때 잘못 추가한 룰. 제거.
  - **교훈**: 원본 CSS 1:1 이식이라고 했지만 작은 추가(`animation: fadeIn`)가 시각적 인지에 결정적 영향. CSS 이식 시 **원본의 빠진 룰을 보강하기보다 원본대로만**.
- **후속 (appReady의 다른 entry route 처리)**: home page만 setAppReady(true) 호출하다 보니 BottomNav로 /history /explore /builder /mypage 같은 (아직 미구현, not-found로 fallback되는) 라우트에 가면 splash가 maxTimer(5초) 다 차야 사라지는 문제. **해법**: 데이터 게이팅 안 하는 entry page는 mount 즉시 `setAppReady(true)` 호출. `app/not-found.tsx`에 useEffect 추가. 향후 entry routes(/login, /signup 등 데이터 없는 페이지) 추가 시 동일 패턴 적용 필수.
- **출처**: Day 3.x fix (2026-05-27)
- **production-wide 정리**: `docs/LESSONS.md` L-018로 동일 내용 production lesson으로 이전 (마이그레이션 외 React/Next.js SSR 오버레이 작업 전반에 해당)

### 2026-05-27 (Day 6) — Chat 1차 (메시지 송수신 + 모델 선택 + 모드 토글 + 재생성)

**작업 범위**: `/character/[id]/chat` 라우트와 채팅 핵심 기능.

**원본 대응**: index.html L450~508 (#screen-chat) + style.css L1366~1645, L1978~2129 + app.js sendMessage / regenerateMessage / renderMessage / setModelUI / toggleMode.

**구현**:
- `web/lib/models.ts` 신규 — MODELS / CHAT_DEFAULT_MODEL / BUILDER_DEFAULT_MODEL / findModel (원본 app.js L1~9와 1:1)
- `web/components/ChatInput.{tsx,module.css}` 신규 — 재사용 input (textarea 자동 height, Enter 전송, IME 안전, iOS 줌인 방지)
- `web/components/ModelPicker.{tsx,module.css}` 신규 — fixed popover, 트리거 위 표시, claude/gemini divider, 외부 클릭으로 닫기
- `web/app/character/[id]/chat/page.{tsx,module.css}` 신규 — 채팅 메인 화면
  - 헤더: 뒤로가기 / 프로필 버튼 (avatar + name + status) / 모드 토글 / 노트 버튼 (placeholder)
  - 메시지 리스트: user/assistant 분기 렌더, assistant는 avatar + sender + bubble + (옵션) pagination + regenerate
  - typing indicator (assistant 응답 대기 중)
  - novel 모드: avatar/sender 숨김, dialogue " " 안 텍스트 하이라이트
  - POST `/api/chat` (첫 메시지엔 persona/characterId/safety 함께)
  - POST `/api/chat/regenerate` 재생성 + 버전 페이지네이션 (versions 배열로 추적)

**chatPrep 흐름**:
- 페르소나 setup 완료 → `useChatPrepStore.setPrep` → /character/[id]/chat 진입
- 마운트 시 `consumePrep()` 호출
- prep 없으면 `/persona?char=<id>` 로 리다이렉트 (직접 URL 입력이나 reload 시 안전망)

**세션 ID**:
- 클라이언트 생성 (`session-<ts>-<rand>` 7자리). 원본 형식 그대로.
- 첫 POST 때 백엔드가 sessions 테이블에 INSERT (persona, characterId, safety, model 함께)

**모바일**:
- ChatInput textarea `font-size: 16px` (iOS 줌인 방지)
- 모든 버튼 touch-action: manipulation + active 피드백
- 메시지 리스트 자체 scroll (`.messages { overflow-y: auto; min-height: 0 }`)

**범위 제외 (Day 6.x 또는 별도)**:
- 노트 모달 (`/api/notes/:sessionId` 저장 + 채팅 헤더 미읽음 도트) — toast placeholder
- 캐릭터 프로필 모달 (헤더 클릭) — toast placeholder
- 기존 세션 로드 (`/history` → chat 재진입) — Day 7 history와 함께
- Safety segment 토글 (intro 화면) — Day 4.x
- 메시지 자동 스크롤 시 사용자 스크롤 보존 (현재는 단순 scrollTop = scrollHeight)

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (`/character/[id]/chat` 5.63 kB / 99.6 kB First Load, dynamic)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 실제 채팅 동작 (Anthropic/Gemini API 호출) — 브라우저 수동 QA

**체크리스트 진척**:
- ✅ 섹션 2.6 (채팅 1차)
- 🟡 노트 / 프로필 모달 / 기존 세션 로드는 Day 6.x

---

### 2026-05-27 (Day 5) — Persona flow (4 routes)

**작업 범위**: 캐릭터 인트로 → 페르소나 설정 → 채팅 진입 직전까지의 4개 라우트.

**원본 대응**: app.js `openPersonaSetup` / `_routePersonaNew` / `_routePersonaSelect` / `_routePersonaSelectEdit` / `startChat` / `startChatFromSelected` / `fillRecommended` / `selectGender`.

**구현**:
- `web/app/styles/forms.css` 신규 — 폼·버튼·네비·헤더·셀렉트카드·페르소나 카드 글로벌 패턴 일괄 이식 (style.css L1089~1361, L1651~1697, L2993~3048, L4202~4275). layout.tsx에서 import.
- `web/lib/format.ts`에 `resolveUser(text, userName)` 추가 — `{{user}}` placeholder를 페르소나 이름으로 치환 (원본과 동일).
- `web/lib/types.ts`에 `Character.recommendedPersona` 추가.
- `web/lib/hooks.ts`에 `usePersonas()` 추가 — 비로그인 시 null key로 fetch 비활성.
- `web/store/chatPrep.ts` 신규 — 채팅 진입 직전 페르소나·safety·characterId 준비 컨텍스트 store. 원본 `window._persona / _characterId / _safety` 대응.
- `web/app/persona/page.tsx` — 리다이렉터 (캐릭터 컨텍스트 + 로그인 + 페르소나 보유 여부에 따라 분기)
- `web/app/persona/new/page.tsx` — 신규 페르소나 폼. **linked** (`?char=<id>`) / **standalone** 모드. linked는 `대화 시작` → chat, standalone은 `저장하기` → /mypage.
- `web/app/persona/select/page.tsx` — 기존 페르소나 목록. 카드 클릭 → edit 페이지, 마지막에 `새 페르소나` CTA.
- `web/app/persona/select/[id]/page.tsx` — 페르소나 prefill 후 일회성 수정 + chat prep set + /character/<id>/chat 이동.
- `web/app/character/[id]/page.tsx` 갱신 — `대화 시작 →` 버튼이 `/persona?char=<id>` 로 (리다이렉터로) 이동.

**ML-004 재발 (Suspense)**:
- 4개 페이지 모두 `useSearchParams` 사용 → build 시 prerender 에러
- 시도 1: `export const dynamic = 'force-dynamic'` 추가 → **해결 안 됨**
- 시도 2 (성공): 페이지를 outer + inner 분리, outer가 `<Suspense fallback={null}>`로 감쌈
- ML-004 강화 규칙 업데이트

**범위 제외 (다음 단계)**:
- 프로필 이미지 업로드 (원본 personaAvatarUpload) — 별도 컴포넌트 작업
- 페르소나 detail 페이지 (`/persona/[id]`, mypage에서 진입) — Day 8 mypage와 함께
- 페르소나 PATCH (기존 페르소나 영구 수정) — Day 8 mypage CRUD와 함께

**Splash 게이팅**:
- 모든 페르소나 라우트에서 `setAppReady(true)` 즉시 호출 (데이터 게이팅 필요 없는 entry route 패턴)

**모바일 인터랙션**:
- 모든 폼 input/textarea `font-size: 16px` (iOS 줌인 방지, `@supports (-webkit-touch-callout)`)
- 모든 버튼 `touch-action: manipulation` + `:active opacity 0.7` + `min-height: 44px`

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (`/persona` 1.75kB / `/persona/new` 3.5kB / `/persona/select` 2.54kB / `/persona/select/[id]` 3.29kB, dynamic)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 시각 비교 / 모바일 — 다음 세션
- ⏸ chat 경로(/character/[id]/chat)는 아직 미구현 → 페르소나 폼 제출 시 404 페이지로 — Day 6에서 해결

**체크리스트 진척**:
- ✅ 섹션 2.3 (Persona setup)
- ✅ 섹션 2.4 (Persona select)
- ✅ 섹션 2.5 (Persona select edit)
- 🟡 Persona detail / 영구 수정 / 아바타 업로드는 Day 8로

---

### 2026-05-27 (Day 4) — `/character/[id]` 캐릭터 인트로 1차

**작업 범위**: 원본 SPA #screen-intro (index.html L185~303) → Next.js App Router 라우트.

**사전 체크 통과**:
- ✅ 원본 코드: app.js `populateIntroScreen` L355~486 / `switchIntroTab` L488 / `toggleLike` L3464 / `toggleBookmark` L3474
- ✅ style.css: intro-* 룰 전체 (L2373~2844) / wb-accordion (L1206~1263)
- ✅ API: `/api/characters` 목록에서 id로 find (원본 SPA 동일 패턴) / `/api/bookmarks/:id` POST·DELETE

**구현**:
- `web/components/IntroAccordion.{tsx,module.css}` 신규 — 펼침/접힘 (세계관 표시용, 재사용 가능)
- `web/app/character/[id]/page.tsx` — 단일 라우트로 모든 섹션 조립:
  - Hero (이미지 + 그라디언트 + floating nav)
  - Floating nav: 뒤로가기 / 좋아요 / 책갈피 / 더보기 (Safety segment는 Day 6로 이연)
  - Identity (role · world / name / nameEn)
  - Stats bar (CHATS / LIKES with fmtK)
  - Created.By (`id.startsWith('char_') && owner_username` 조건)
  - Tab bar (ABOUT / NOTES / COMMENTS, role="tablist"+role="tab"+aria-selected)
  - ABOUT panel: 카드 grid (WORLD / AVG.LENGTH / TONE 중 값 있는 것만) + traits + opening line bubble + description 단락 + worldbuilding accordion
  - NOTES panel: creator_note + rules (ol) + tip 카드 + 푸터 (NOTES BY · date). 빈 상태 처리.
  - COMMENTS placeholder
  - Bottom CTA "대화 시작 →" → `/character/[id]/chat` (Day 6에서 실제 페이지)
- `web/app/character/[id]/page.module.css` — intro-* 룰 1:1 이식
- `web/lib/types.ts` — `Character.description?: string[]` 추가 (인트로 ABOUT 패널 단락)

**핸들러**:
- 좋아요: 비로그인 시 AuthGate, 로그인 시 로컬 토스트만 (원본도 `_likedIds` Set만, 백엔드 없음)
- 책갈피: 비로그인 시 AuthGate, 로그인 시 `/api/bookmarks/:id` POST/DELETE + 토스트
- Follow: 단순 라우팅 (`/creator/@<handle>`)
- 더보기: "준비 중입니다" 토스트 (원본과 동일)

**Splash 게이팅**:
- HomePage와 동일하게 `useEffect`로 `setAppReady(true)` 호출 (isLoading=false 시점)
- 캐릭터 미존재 시 Next.js `notFound()` 호출 → not-found.tsx 폴백

**모바일 인터랙션 (L-012)**:
- navBtn / actionBtn / followBtn / tab / startBtn 모두 `touch-action: manipulation` + `:active { opacity: 0.7 }`
- tab은 `min-height: 44px` 보장, startBtn `height: 44px`

**범위 제외 (다음 Day로)**:
- Safety segment 토글 (Day 6 chat 작업과 함께 — 등급별 분기 로직 + adult_content_enabled 체크)
- 좋아요 백엔드 연동 (현재 백엔드에 endpoint 없음 — 향후 `/api/likes/:id` 추가 시 연결)
- More 메뉴 (공유 / 신고 등 — 별도 모달 필요)
- `/character/[id]/chat` 라우트 자체 (Day 6)

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (`/character/[id]` 5.15 kB / 104 kB First Load, dynamic route)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 시각 비교 / 모바일 — 다음 세션

**체크리스트 진척**:
- ✅ 섹션 2.2 (캐릭터 인트로 1차 — 핵심 구조 완료)
- 🟡 잔여: Safety segment / 좋아요 백엔드 / More 메뉴

---

### ML-010 — Next.js App Router의 favicon은 `web/app/favicon.ico` 에 있어야 함
- **증상**: 브라우저 탭 favicon 안 뜸. 원본 `public/favicon.ico`는 Express가 서빙하지만 Next.js 3001은 모름.
- **원인**: App Router는 `app/favicon.ico` (또는 `app/icon.{ico|png|svg}`) 규약. `web/public/`에 두면 dev에선 서빙되지만 `app/` 규약 충돌. 부모 프로젝트의 `public/favicon.ico`는 next.config.mjs rewrites에 등록 안 한 경로라 404.
- **예방**: 부모 프로젝트의 favicon을 `web/app/favicon.ico`로 복사. App Router가 `<link rel="icon">` 자동 주입 + 적절한 헤더 부여. rewrites 불필요.
- **출처**: Day 3.x fix (2026-05-27)

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
