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

### 검증 비용 등급 (토큰/시간 최적화 — 2026-05-28 자체 검증에서 정립)
> 그동안 매 작업마다 build + `.next` 삭제 + dev 재시작을 했으나, HMR로 반영되는 변경엔 불필요했음.
> 변경 성격에 따라 최소 검증만 수행:

| Tier | 언제 | 명령 | 비고 |
|---|---|---|---|
| 1 | 모든 코드 변경 | `npm run type-check` | 빠르고 쌈. 거의 항상. |
| 2 | UI/컴포넌트/CSS | + `npm run lint` | **dev 재시작 불필요** — HMR로 자동 반영 |
| 3 | 새 라우트 / Suspense / 정적생성 영향 | `npm run build` | prerender·useSearchParams 에러는 여기서만. **build 후 `.next`는 그대로 둔다**(IDE 타입 유지). dev는 `predev` 훅이 자동 정리 (ML-003 갱신) |
| 4 | 백엔드 routes/db/lib | `npx jest` | 49개 |

- **build와 dev 재시작은 매번 X.** 기존 페이지 로직/CSS 수정은 Tier 1~2만.
- **새 page.tsx 추가 시에만 Tier 3** (Suspense·정적생성 함정 잡기).
- 커밋 직전 한 번 전체(Tier 3+4) 돌려 최종 확인.

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

### ML-003 — `next build` 직후 `next dev`로 전환 시 `.next` 폴더 충돌 + (추가) 수동 `.next` 삭제가 IDE 오류 유발
- **증상**: `Error: Cannot find module './XXX.js'` (webpack-runtime), 페이지 렌더 실패
- **원인**: production chunk와 dev chunk가 같은 `.next` 폴더 공유. webpack runtime이 잘못된 chunk hash를 참조.
- **(2026-06-04 추가 발견)**: 이를 피하려고 build 후 **`.next`를 수동 삭제**해 왔는데, 그러면 `.next/types/app/**/page.ts`(라우트당 1개씩 생성되는 타입)가 사라져 **IDE의 `next` TS 플러그인이 tsconfig의 `.next/types/**/*.ts` include를 못 채워 라우트 수만큼 오류**를 표시한다(예: 18라우트 → "오류 18~19개"). CLI `tsc --noEmit`은 빈 glob을 무시해 통과하므로 IDE만 빨개지는 함정. → **수동 삭제 자체가 새 마찰의 원인**이었음.
- **해결 (영구)**: `package.json`에 **`predev` 훅** 추가 — dev 시작 전 `.next`를 자동 정리하므로 build→dev 충돌이 구조적으로 불가능해지고, **수동 `rm -rf .next`를 더 이상 하지 않는다**(= IDE 오류 미발생). 의존성 없이 node 내장 사용:
  ```json
  "predev": "node -e \"require('fs').rmSync('.next',{recursive:true,force:true})\"",
  "dev": "next dev -p 3001",
  ```
- **새 워크플로**: build로 검증한 뒤 `.next`를 **그대로 둔다**(IDE 타입 유지). 다음에 dev를 켜면 `predev`가 알아서 정리. IDE가 오류를 계속 보이면 "TypeScript: Restart TS Server" 1회.
- **출처**: Day 3.x 종료 후(2026-05-27), Day 14 후 IDE 19 오류 사건으로 갱신(2026-06-04)

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

### 2026-06-04 (Day 14.1) — persona/new 아바타 업로드 연결

Day 5에서 placeholder로 둔 `/persona/new` 프로필 이미지 업로드를 `AvatarUpload`(Day 13 신규 컴포넌트)로 연결.
- 폼 최상단에 AvatarUpload 추가, `avatar` state.
- 제출 data에 `...(avatar ? { avatar } : {})` 포함 — linked/standalone 양쪽. avatar는 dataURL이라 resolveUser 치환 제외(원본 startChat 동일).
- 검증: type-check / lint (기존 라우트, build 불필요).

### 2026-06-04 (Day 14) — 페르소나 상세/편집 (/persona/[id])

**작업 범위**: 마이페이지 '편집' 버튼이 toast였던 것을 실제 페이지로. 원본 #screen-persona-detail (index.html L992~1011, app.js `_routePersonaDetail`/`onPdImgSelected`).

- `app/persona/[id]/page.{tsx,module.css}` — 전체 필드 편집 + PATCH 영구 저장.
  · 필드: 아바타(AvatarUpload 재사용)/이름/나이/성별/외형/성격/특이사항.
  · 저장 → `PATCH /api/personas/:id { data }` → mutate → /mypage.
  · 액션: 기본 설정 / 기본 해제(default DELETE) / 삭제(showDeleteConfirm). default 변경 시 authStore.user.default_persona_id 로컬 동기화.
  · 잘못된 id → /mypage 리다이렉트(원본 동작).
- `app/mypage/page.tsx`: onEditPersona → `router.push('/persona/:id')` (toast 제거).

**결정**:
- **원본 detail은 읽기전용+아바타만**이었으나, web mypage가 이미 '기본으로/편집/삭제'로 분리돼 detail-only면 기능 중복·빈약 → 사용자 확인 후 **전체 필드 영구 편집**으로 확장(백엔드 PATCH가 full data 교체 지원). 원본 `/persona/select/:id`(채팅 진입 일회성 수정)와 역할 구분: 이건 **영구 저장**, 그건 **그 대화 한정**.
- 정적 세그먼트(new/select) 우선이라 `/persona/[id]`가 `/persona/new`·`/persona/select` 안 가로챔(build 확인).
- BottomNav는 기존 HIDE_PATTERNS `/persona(\/.*)?`로 숨김 — 원본 detail은 nav 표시였으나 web 컨벤션(Day 5) 유지.

**종료 체크**: ✅ type-check / lint / build (/persona/[id] 4.67kB)

### 2026-06-03 (Day 13) — Builder 캐릭터 제작 (AI 대화형 + 직접 제작)

**작업 범위**: 빌더 전체 4개 화면. 원본 #screen-builder/-chat/-loading/-manual/-edit (index.html L512~777, app.js L2130~3275).

**라우트**:
- `/builder` — 방식 선택 (select-card 2개: AI 빌더 / 직접 만들기). placeholder였던 페이지 교체.
- `/builder/chat` — AI 대화형. 마운트 시 '시작해줘' 자동 전송(1회 재시도, useRef StrictMode 가드). ModelPicker(Sonnet 4.6 기본)+ChatInput 재사용. `[CHARACTER_READY]` 감지 → CTA → generate → preview.
- `/builder/manual` — 직접 폼. 클라이언트 system.md 생성 → create → 홈.
- `/builder/preview` — AI 결과 검토/편집. 등록 또는 ↺ 재생성. store 비면 `/builder` 리다이렉트(reload 안전).

**공통 신규**:
- `store/builder.ts` — `useBuilderStore` (model/sessionId/charData/systemMd). chat→preview 컨텍스트 유지. 원본 글로벌 변수 대응.
- `components/AvatarUpload.{tsx,module.css}` — FileReader dataURL 업로드 (원본 createAvatarUpload). persona 등 재사용 가능.
- `components/TagInput.tsx` — 칩+추천 태그 입력(중복불가/#제거/최대8). forms.css 글로벌 클래스 사용.
- `components/BuilderLoading.{tsx,module.css}` — 진행바 로딩 오버레이(fixed). 라우트가 아닌 state 오버레이로 처리(원본 showScreen 대응).
- `lib/builder.ts` — cleanBuilderReply / extractCharReady / generateManualSystemPrompt.
- `lib/types.ts` — BuilderCharData / BuilderRating.
- `app/styles/forms.css` — label-hint / tag-input-wrap / tag-chip / tag-suggest / rating-select 글로벌 추가(manual+preview 공유).

**결정/회고**:
- **loading을 라우트가 아닌 오버레이 state로**: 원본은 `showScreen('screen-builder-loading')`로 URL 안 바꿈. charData/systemMd가 in-memory store라 별도 /loading 라우트로 빼면 새로고침 시 컨텍스트 소실. progress state(null=비활성)로 같은 페이지 위에 표시.
- **chat→preview state 전달은 zustand store**: D-019의 "URL query as source of truth" 원칙 예외. charData/systemMd가 크고 JSON이라 URL 부적합 + 단방향 1-hop. reload 시 store 비면 /builder로 안전 복귀.
- **인증 정책 (중요)**: 빌더는 **UI만 로그인 게이트**(useRequireAuth) — 원본 openBuilder/Chat/Manual의 authGate와 동일. **백엔드 `/api/builder/chat`·`/generate`는 의도적으로 비인증 개방**(routes/builder.js L10-12: 포트폴리오 데모 시연 목적, Codex R4 F2 롤백 결정). 저장 단계 `POST /api/characters/create`만 requireAuth라 orphan 캐릭터는 안 생김. 직접 API 호출 비용 차단(per-IP rate limit)은 백로그.
- BottomNav는 기존 HIDE_PATTERNS `/builder/(chat|manual|loading|preview)`로 sub-screen 숨김.

**종료 체크**: ✅ type-check / lint / build (builder 4 라우트: 선택 4.75kB, chat 5.22kB, manual 3.23kB, preview 3.01kB)

**QA 2차 (Codex, 2026-06-03)**: build/type-check/lint/jest(49) 통과. Findings 처리 —
- 🟢 수정: Creator 프로필 adult_only 필터 누락(선재 백엔드 버그, routes/creator.js) — 비성인/비로그인에 숨김. (self-eval에서 owner-bypass가 mypage와 불일치함을 발견 → bypass 제거해 characters.js·mypage와 완전 일관.)
- 🟢 수정: AvatarUpload 클라 5MB 체크 추가(mypage와 일관). 서버 강제는 백로그.
- 🔵 반박(조치 안 함): Builder 백엔드 비인증 = 의도된 데모 개방(위 정책). preview 검증이 manual보다 약함 = 원본 registerCharacter도 이름만 검증(회귀 아님, AI가 완전 데이터 보장).
- 🟡 백로그: 캐릭터 생성 이미지 서버측 5MB 검증, 알림 단건 read 소유권 조건.

### 2026-06-03 (Day 12) — Creator 프로필 (/creator/@:username)

**작업 범위**: 원본 #screen-creator (index.html L1240~1250, style.css L5069~5250, app.js L1104~1216).

- `app/creator/[handle]/page.{tsx,module.css}` — 동적 `[handle]`=`@username`(decode 후 @ 제거). 헤더(avatar+nick+handle+액션) / 통계 바 WORKS·CHATS·LIKES / PINNED.WORK / ALL.WORKS.
- isOwner면 프로필 편집(MypageInfoModal 재사용) + 핀 토글(⊛/⊙), 아니면 팔로우(toast).
- `lib/hooks.ts` `useCreator(handle)` SWR + mutate. `lib/types.ts` CreatorProfile/CreatorCharacter **정확한 타입으로 교체**(기존 미사용 stub 제거 — 백엔드 응답 shape에 맞춤).
- 공개 페이지(비로그인 조회 가능), BottomNav 표시(원본과 동일).

**종료 체크**: ✅ type-check / lint / build (2.3kB)

### 2026-06-03 (Day 11) — Notification 알림함 (/notification)

**작업 범위**: 원본 #screen-notification (index.html L838~868, style.css L3307~3622, app.js L878~1059).

- `app/notification/page.{tsx,module.css}` — 헤더(INBOX.feed + [N new] + MARK ALL) / 필터 탭 ALL·SOCIAL·SYSTEM·NOTICE / 날짜 그룹 TODAY·YESTERDAY·THIS.WEEK·EARLIER / 알림 행(아이콘+뱃지+recent/read 보더).
- NOTICE 아코디언: `useLayoutEffect`로 scrollHeight 측정 → 오버플로 시 더보기/접기(원본 applyNoticeAccordions).
- 읽음 처리/MARK ALL: 낙관적 mutate + PATCH. 로그인 시만(원본 _currentUser 가드).
- 정책: 알림은 공개 — 비로그인은 브로드캐스트만(전부 unread).

**종료 체크**: ✅ type-check / lint / build (4.48kB)

### 2026-06-03 (Day 10.3) — Explore 큐레이션 섹션 (BROADCAST/TAG.CLOUD/EDITOR.PICKS)

- `app/explore/ExploreCuration.{tsx,module.css}` — BroadcastCarousel(4초 auto-advance+dots+스와이프) / TAG.CLOUD(FeedHeader+tag-pill) / EDITOR.PICKS(collection 카드). useCuration의 broadcast/tags/collections.
- explore page: 검색/태그 비active일 때만 큐레이션 섹션 표시(원본은 항상이나 검색 중엔 결과 집중 UX). Explore 완성.

**종료 체크**: ✅ type-check / lint (새 라우트 아님 — build 생략)

### 2026-05-28 (Day 8.3) — 아바타 업로드 + 탈퇴 (Mypage 완성)

**작업 범위**: mypage의 마지막 placeholder 2개 동작화. 새 page/컴포넌트 없음 → 검증 Tier 1~2.

**원본 대응**: app.js handleAvatarChange (L3851~3867) / confirmDeleteAccount (L4305~4314).

**구현 (mypage page.tsx 내부)**:
- **아바타 업로드**: hidden file input + ref. 클릭 → `avatarInputRef.click()`.
  - 5MB 초과 가드 (base64 ~33% 팽창 → express.json 10mb 한도 내, body-parser 한도 사전 확인 — CLAUDE.md 버그 패턴)
  - FileReader.readAsDataURL → `PATCH /api/auth/me { avatarData }` → setUser
  - 같은 파일 재선택 위해 input.value 리셋
- **탈퇴**: `showDeleteConfirm` 재사용 (전용 모달 안 만듦)
  - 확인 → `DELETE /api/auth/me` → setUser(null) → `/` 이동 + toast

**종료 체크**:
- ✅ type-check / ESLint clean
- ⏸ jest / build / dev 재시작 — 백엔드·page 변경 없어 skip (하네스)

**Mypage 전체 완료 (8.1~8.3)**: 프로필 / 설정 / 탭(페르소나·캐릭터·책갈피) / 정보수정 / 성인인증 / 아바타 / 탈퇴 / 로그아웃. 잔여: 페르소나 편집 페이지, 빌더 편집 (별도 Day).

---

### 2026-05-28 (Day 8.2) — 정보수정 모달 + 성인 인증 모달 + adult 토글 동작

**작업 범위**: mypage의 EDIT/정보수정 → 모달, 성인 콘텐츠 토글 실제 동작. 새 page 없음 → 검증 Tier 1~2만.

**원본 대응**: app.js openMypageModal('info') (L4146~4192) / saveInfo / setAdultToggle (L3310) / openAdultVerify / confirmAdultVerify (L3353~3389).

**구현**:
- `web/store/ui.ts`: `adultVerify` 상태 + openAdultVerify/closeAdultVerify (closeAdultVerify는 onClose 콜백으로 토글 원복 지원)
- `web/lib/useAdultContent.ts` 신규 — 토글 로직 공유 훅
  - `setAdult(enable, intendedPath)`: OFF 즉시 / 비로그인 AuthGate / 인증완료 즉시 PATCH / 미인증 AdultVerifyModal
  - 토글 후 useCharacters mutate (서버 필터링 반영)
- `web/components/AdultVerifyModal.{tsx,module.css}` 신규 — 글로벌 모달
  - 체크박스 동의 → POST /api/auth/adult-verify (verified=1 + enabled=1)
  - layout.tsx에 마운트
- `web/components/LandingHeader.tsx` 리팩토링 — 중복 setAdult 로직 제거, useAdultContent 사용 (코드 -55줄). 이제 18+ 토글이 AdultVerifyModal 띄움 (이전엔 "모달 구현 예정" toast)
- `web/app/mypage/MypageInfoModal.{tsx,module.css}` 신규 — mypage 전용
  - 닉네임 / @아이디(debounced 가용성 체크) / 이메일 / 비밀번호 변경 (current+new)
  - 변경된 필드만 PATCH /api/auth/me
- `web/app/mypage/page.tsx`: EDIT/정보수정 → setInfoModalOpen, adult 토글 → setAdult 연결

**username 정책 (반박 → 사용자 결정)**:
- 원본 모달은 username 수정 제공, routes/auth.js PATCH도 허용
- CLAUDE.md 절대금지 7번("username immutable")과 충돌 → 사용자에게 확인
- **결정: 원본대로 수정 허용**. CLAUDE.md 7번은 현실과 안 맞는 구조문 → docs 업데이트 필요 (TODO).

**모달 아키텍처 결정**:
- AdultVerifyModal = 글로벌 (LandingHeader + mypage 공유) → useUIStore + layout 마운트
- MypageInfoModal = mypage 로컬 (다른 데서 안 씀) → mypage 폴더 안에 둠

**종료 체크**:
- ✅ type-check 통과
- ✅ ESLint clean
- ⏸ jest — 백엔드 변경 없어 skip (하네스 Tier 4 해당 안 됨)
- ⏸ build/dev 재시작 — 새 page 없어 skip (하네스: 컴포넌트/layout은 HMR)

---

### 2026-05-28 (Day 8.1) — Mypage 1차 (profile + settings + tabs + lists)

**작업 범위**: `/mypage` 라우트의 핵심 구조. 모달/업로드/탈퇴는 Day 8.2/8.3로 분리.

**원본 대응**: index.html L1013~1169 (#screen-mypage) + style.css L3721~4505.

**추가**:
- `web/lib/hooks.ts`: `useBookmarks()` — 로그인 사용자 북마크 char_id 배열 (비로그인 비활성)
- `web/app/mypage/page.tsx` + `.module.css` — 단일 페이지에 모든 섹션:
  - 프로필 카드 (avatar/nickname/email/CREATOR 뱃지)
  - 설정 섹션 4개 row (정보수정, adult 토글 (display only), 모델, 토큰)
  - 탭바 (페르소나/캐릭터/책갈피) + 카운트 + 슬라이드 indicator
  - 페르소나 패널: usePersonas + 기본설정 / 편집(toast) / 삭제 (showDeleteConfirm 재사용)
  - 캐릭터 패널: useCharacters에서 `id.startsWith('char_') && owner_username === user.username` 필터 + 편집(toast) / 삭제 (R4 가드 통과) + `+ 새 캐릭터 만들기` → /builder
  - 책갈피 패널: useBookmarks ∩ useCharacters + 해제 (`DELETE /api/bookmarks/:id`)
  - 메뉴 리스트 (좋아요/크리에이터/어드민/팔로잉/설정/지원/로그아웃 = openLogout 재사용)
  - 푸터 + 탈퇴 button (toast placeholder)

**비로그인 처리**:
- `useEffect`에서 `!user` 시 `showAuthGate({ intendedPath: '/mypage' })` 호출 (L-011 패턴)
- 페이지는 빈 wrap 렌더 (AuthGate가 로그인/뒤로 안내)

**모바일**:
- 모든 row `min-height: 52px`, `touch-action: manipulation`
- 탭 버튼 `min-height: 44px`
- charLink/addBtn `touch-action: manipulation` + `:active opacity 0.7`

**범위 제외 (Day 8.2 / 8.3)**:
- 정보 수정 모달 (PATCH /api/auth/me — 닉네임/이메일/비번) → "Day 8.2에서" toast
- 성인 인증 모달 + adult 토글 동작 → 동일
- 아바타 업로드 → "Day 8.3에서" toast
- 탈퇴 (DELETE /api/auth/me) → 동일
- 페르소나 편집 페이지 → 별도

**종료 체크**:
- ✅ type-check 통과
- ✅ ESLint clean (no warnings/errors)
- ✅ jest 49/49 통과
- ⏸ 브라우저 시각/플로우 확인 — 다음 세션

---

### 2026-05-28 (Day 9) — History + chatPrep persistence (Codex F5 해결)

**작업 범위**: `/history` 라우트 + chat 페이지의 `?session=<id>` URL 파라미터 hydration.
**효과**: 사용자가 과거 대화를 다시 볼 수 있고, 새로고침/직접 URL 진입 시 채팅이 정상 복원됨 (chatPrep memory-only 한계 해결).

**원본 대응**: index.html L152~172 (#screen-history) + style.css L1722~1914 + app.js loadSessionList / loadSession / handleDeleteAll / handleDeleteClick / confirmDelete.

**백엔드 (수정 없음)**:
- `GET /api/sessions` — 사용자/게스트 격리된 세션 목록 (이미 있음)
- `GET /api/sessions/:id` — 세션 + 전체 메시지 (이미 있음)
- `DELETE /api/chat/:sessionId` — 삭제 (이미 있음)

**프론트 추가**:
- `web/lib/hooks.ts`: `useSessions()` / `useSession(id)` — SWR 훅
- `web/app/history/page.tsx` + `.module.css`:
  - 세션 카드 (캐릭터 아바타 + 페넌트 + 캐릭터명 + 날짜 + 미리보기 + 페르소나 태그)
  - 선택모드 (체크박스 슬라이드, 다중 선택)
  - 전체삭제 / 선택삭제 — `useUIStore.showDeleteConfirm`으로 재사용 모달
- `web/app/character/[id]/chat/page.tsx` 리팩토링:
  - `useSearchParams`로 `?session=<id>` 읽음 → outer를 Suspense로 감쌈 (ML-004)
  - `useSession(sessionParam)` hook으로 백엔드 hydrate
  - hydration 분기:
    - `?session=<id>` 있고 로드 성공 → persona/safety/model/messages 모두 백엔드에서 복원, sessionId = URL의 값
    - `?session=<id>` 있고 character_id 불일치 → /history로 redirect (URL 조작 차단)
    - `?session=<id>` 있고 로드 실패 → /history로 redirect
    - `?session` 없으면 기존 chatPrep 소비 흐름 그대로 (신규 채팅)
  - **새 채팅 첫 메시지 성공 후 router.replace로 `?session=<id>` 추가** → 새로고침해도 같은 세션 유지 (Codex F5 해결)

**리다이렉트 정책 변경**:
- 이전: prep 없으면 무조건 `/persona?char=<id>`
- 이후: `?session=` 있고 hydration 실패면 `/history`로, 신규 prep 없으면 `/persona?char=<id>` (둘 다 의미 있는 fallback)

**브라우저 시나리오**:
1. `/history`에서 카드 클릭 → `/character/ihwa/chat?session=session-xxx-yyy` → 메시지·페르소나·safety·model 모두 복원
2. 새 채팅 시작 → 메시지 1번 보냄 → URL이 `?session=session-xxx-yyy` 으로 갱신 → 새로고침해도 그 세션 유지
3. 새 채팅 진입 후 새로고침 (메시지 0번 보냄 상태) → `?session` 없으므로 prep 없음 → `/persona?char=<id>`로 redirect (기존 동작)

**Codex F5 (chatPrep memory-only) 해결**:
- 이전: chatPrep in-memory zustand만 사용 → 새로고침/직접 URL 진입 깨짐
- 이후: 첫 메시지 직후 URL이 source of truth로 전환 → in-memory store는 persona setup → chat 진입의 한 hop만 담당
- Refresh-safe.

**모바일**:
- 세션 카드 `touch-action: manipulation` + `:active opacity 0.85`
- action 버튼 `min-height: 28px`

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (`/history` 3.76 kB static, `/character/[id]/chat` 7.01 kB dynamic)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 실제 세션 로드 / 삭제 / refresh persistence — 브라우저 수동 QA

**잔여**:
- Note dot (헤더의 "📝" 옆 빨간 점) — 노트 모달과 함께 Day 6.x로
- userImageUrl restore (localStorage `user-img:<sessionId>`) — 아바타 업로드 작업과 함께
- Day 9 후 codex R3 리뷰 권장

---

### 2026-05-28 (Day 10.2) — Explore 랭킹 뷰 (mock 차트 TOP 20)

**작업 범위**: explore의 랭킹 뷰. 원본 _chartData/_chartLabels/_renderChart 이식.

**추가**:
- `web/lib/exploreChart.ts` — CHART_DATA(daily/weekly/monthly × 20) + CHART_LABELS (원본 1:1, ⚠️ 시연용 mock)
- `web/app/explore/page.tsx` — RankingView 컴포넌트 (placeholder 교체)
  - 일간/주간/월간 sort 버튼 + 날짜 라벨 (주간은 월~일 범위 계산)
  - 차트 행: rank / avatar / name / role·chats / change(▲▼—)
- `page.module.css` — chart-* 1:1 이식

**비고**: 랭킹 데이터는 **하드코딩 mock** (실제 집계 API 없음 — 원본도 동일). 포트폴리오 차트 UI 데모.

**종료 체크**:
- ✅ type-check / ESLint clean (page 수정, 새 라우트 아님 → build skip)

**Day 10.3 (잔여)**: BROADCAST 배너 / TAG.CLOUD / EDITOR.PICKS 큐레이션 섹션 (useCuration의 broadcast/tags/collections)

---

### 2026-05-28 (Day 10.1) — Explore 큐레이션 뷰 (검색 + 태그 필터 + grid)

**작업 범위**: `/explore` 라우트의 큐레이션 뷰. 랭킹 차트 + 큐레이션 데이터 섹션(BROADCAST/TAG.CLOUD/EDITOR.PICKS)은 Day 10.2.

**원본 대응**: index.html L779~835 (#screen-explore) + app.js loadExplore / _buildExploreTagBar / _applyExploreFilter / matchesQuery / getChosung (L1577~1708).

**추가**:
- `web/lib/search.ts` — `matchesQuery(char, q)` + `getChosung(str)` (한글 초성 검색). 원본 1:1.
- `web/app/explore/page.tsx` + `.module.css`:
  - 뷰 탭 (큐레이션 / 랭킹) — 랭킹은 "준비 중" placeholder (Day 10.2)
  - 검색 (300ms debounce, ESC로 초기화, 초성 지원)
  - 태그 바 (추천 12태그 + 캐릭터 태그 병합, 다중 선택 AND, 전체 chip)
  - char grid (CharacterCard 재사용)

**필터 로직 (원본 _applyExploreFilter)**:
- `matchesQuery(c, query) && (activeTags 비었거나 모든 선택 태그 포함)`
- useMemo로 characters/query/activeTags 변경 시만 재계산

**종료 체크**:
- ✅ type-check / ESLint clean
- ✅ build 통과 (`/explore` 1.96 kB / 113 kB, static)

**Day 10.2 (다음)**:
- 랭킹 차트 (mock _chartData daily/weekly/monthly + sort)
- BROADCAST 배너 / TAG.CLOUD / EDITOR.PICKS 큐레이션 섹션 (useCuration의 broadcast/tags/collections)

---

### 2026-05-28 (Day 4.x) — 인트로 Safety segment (전연령/성인 모드 토글)

**작업 범위**: 캐릭터 인트로 floating nav의 Safety segment placeholder 채우기 + safety 값을 chat 진입까지 전달.

**원본 대응**: app.js createSafetySegment (L504~547) + mountSafetySegment (L553~570) + style.css safety-segment (L1008~1077, intro 변형 L2472~2486).

**추가**:
- `web/components/SafetySegment.{tsx,module.css}` — 🔒 전연령 / 🔞 성인 토글
  - 슬라이딩 배경 pill (`data-safety` attribute로 CSS 제어)
  - canToggle false면 잠김 (opacity 0.55)
- `web/app/character/[id]/page.tsx`:
  - 원본 mountSafetySegment 로직: `ratingLocked = rating==='toggleable' && !adultEnabled`, `canToggle = safetyToggle !== false && !ratingLocked`
  - safety 초기값 = ratingLocked ? 'on' : defaultSafety (char 로드 시 useEffect)
  - floating nav에 SafetySegment 렌더
  - "대화 시작" → `/persona?char=<id>&safety=<safety>`

**safety URL 전달 (전 persona 흐름)**:
- `/persona?char=&safety=` 리다이렉터가 select/new로 넘길 때 safety 유지
- `/persona/select?char=&safety=` → select/[id]로 전달
- `/persona/new`, `/persona/select/[id]`: setPrep의 safety를 query 우선(없으면 char.defaultSafety)
- 새로고침 안전 (URL이 source of truth)

**설계 결정 (safety 전달 방식)**:
- 원본은 글로벌 `currentSafety` 변수. React에선 URL query로 — chatPrep store는 한 hop(persona→chat)만 담당하므로, 인트로→persona 사이는 URL이 적절. 새로고침/뒤로가기 안전.

**종료 체크 (전체 검토용 풀 검증)**:
- ✅ type-check 통과
- ✅ ESLint clean
- ✅ build 통과 (`/character/[id]` 6.xx kB)
- ✅ 백엔드 jest 49/49

**인트로 화면 완성**: hero / safety segment / 좋아요·책갈피 / identity / stats / created.by / 탭(about·notes·comments) / 세계관 accordion / 대화 시작. 좋아요·Follow·More는 백엔드 미구현이라 toast (원본 동일).

---

### 2026-05-28 (Day 6.x-2) — 노트 모달 + 캐릭터 프로필 모달 (채팅 완성)

**작업 범위**: chat 헤더의 마지막 placeholder 2개(📝 노트, 프로필 버튼) 동작화. 새 page 없음 → Tier 1~2.

**원본 대응**: index.html L466~496 (#char-profile-overlay, #note-overlay) + app.js openCharProfile (L2311) / openNote·saveNote (L2372~2409).

**추가**:
- `web/lib/types.ts`: Character에 `fullName` / `subtitle` / `profile` 추가 (list 응답이 config 전체를 `...config`로 펼치므로 이미 옴)
- `web/app/character/[id]/chat/CharProfileModal.{tsx,module.css}` — 이미지/이름/subtitle/profile rows/제작자 노트(description)
- `web/app/character/[id]/chat/NoteModal.{tsx,module.css}` — GET/PUT `/api/sessions/:id/note`, 1000자 카운트, 저장 시 onSaved(hasNote)
- `web/app/character/[id]/chat/page.tsx`:
  - 프로필 버튼 → setProfileOpen, 노트 버튼 → setNoteOpen + hasNote dot
  - 기존 세션 진입 시 노트 존재 여부 로드 → 헤더 dot
  - 두 모달 렌더

**노트 한계 (원본 동일)**:
- 첫 메시지 전(백엔드 세션 미생성)엔 GET/PUT 404 → 빈 노트, 저장 시 안내 toast
- 첫 메시지 후 ?session= 생기고 백엔드 세션 존재하므로 정상

**종료 체크**:
- ✅ type-check / ESLint clean
- ⏸ jest/build/dev재시작 skip (하네스)

**채팅 화면 완성**: 송수신·스트리밍·재생성·모델·모드토글·노트·프로필·기존세션로드 전부 동작. Safety segment(인트로)만 잔여(Day 4.x).

---

### 2026-05-28 (Day 6.x) — 채팅 SSE 스트리밍 (token-by-token typewriter UX)

**작업 범위**: 기존 non-stream 일괄 응답을 Server-Sent Events 스트리밍으로 전환.
원본 SPA는 한꺼번에 응답 받아 표시했는데, 사용자 요청으로 ChatGPT/Claude.ai 같은 점진 표시 UX 도입.

**원본 대비 차이 (의도된 개선)**:
- 백엔드: `anthropic.messages.create` / `gemini.generateContent` → stream API
- 응답 형식: JSON `{ reply, ... }` → SSE `data: {"type":"delta"|"done"|"error",...}\n\n`
- 프론트: `await fetch` → `for await (event of streamSSE(...))`

**구현**:
- `lib/streamReply.js` 신규 — Anthropic + Gemini stream 통일 인터페이스
  - `streamReply({ model, systemPrompt, history, maxTokens, onDelta })` → 완성된 전체 텍스트 반환
  - Anthropic: `messages.create({...stream:true})` async iterator, `content_block_delta` 이벤트에서 text_delta 추출
  - Gemini: `models.generateContentStream(...)`, chunk.text로 thought parts 자동 제외
- `routes/chat.js` SSE 전환
  - SSE 헤더 (`text/event-stream` + `no-cache` + `X-Accel-Buffering: no` for nginx proxy)
  - `req.on('close')` abort 감지 → SDK iteration 끝나면 partial이라도 DB 저장 (사용자 history 보존)
  - 에러 시 `data: {"type":"error","error":"..."}\n\n` 후 partial 저장 + res.end
  - 정상 종료 시 `data: {"type":"done","sessionId","model","characterId"}\n\n`
  - 안전 위반 자동 로그 (전연령 모드)는 누적 텍스트 기준 그대로 작동
- `routes/regenerate.js` 동일 패턴 SSE 전환 (sessionId + model 받음, session.model 갱신, 옛 assistant 메시지 삭제 후 stream)
- `web/lib/api.ts` `streamSSE<T>(path, body, { signal? })` 헬퍼 추가
  - AsyncGenerator로 SSE 블록 yield
  - `data:` 라인만 처리, `event:`/`id:`/`retry:` 무시 (스펙 준수)
  - HTTP 4xx/5xx에는 ApiError 던짐 (스트림 시작 전 에러)
  - 깨진 JSON 블록은 silently skip
  - AbortSignal 지원 (페이지 이탈 시 호출자가 중단 가능 — Day 6.x에서 호출자 측 abort는 아직 미사용)
- `web/app/character/[id]/chat/page.tsx` 리팩토링
  - `api.post` → `streamSSE` 호출로 변경
  - 첫 delta 도착 시 assistant 메시지 append, 이후 delta는 마지막 메시지의 versions[0] in-place 갱신
  - 재생성: 빈 새 버전을 미리 추가해 typing dots 보여주고, delta 도착하면 그 버전 텍스트 채움
  - 에러 시 partial이 있으면 텍스트에 (에러) 덧붙임, 없으면 별도 assistant 메시지로 추가
  - 재생성 실패 + partial 없음 → 빈 새 버전 제거하고 이전 버전으로 복귀
- `MessageBubble` props 정리
  - `sending` → `streaming` 으로 리네이밍 (의미 명확화)
  - `showTyping = streaming && text.length === 0` — 텍스트가 없을 때만 dots, 한 글자라도 오면 즉시 점진 표시
  - streaming 중엔 pagination/regen 버튼 숨김 (사용자 spam 방지)

**원본 대비 변경 (외부 호환 영향)**:
- `POST /api/chat` 응답 형식 변경 (JSON → SSE). 원본 SPA(public/js/app.js)는 아직 JSON 기대하므로, **원본 SPA로 채팅 화면 진입 시 깨짐**. 단 마이그레이션 후엔 Next.js 클라이언트만 사용하므로 영향 없음.
- 마이그레이션 완료 전까지 원본 SPA를 함께 운영하려면 별도 endpoint 분리 검토 필요 (현재는 안 함).

**lib/gemini.js**:
- non-streaming `callGemini`는 그대로 유지 (memory.js / builder.js / admin.js / releaseNotify.js가 사용)
- 채팅/재생성만 streamReply로 전환

**종료 체크**:
- ✅ type-check 통과
- ✅ web build 통과 (`/character/[id]/chat` 5.74 kB, dynamic)
- ✅ 백엔드 jest 49/49 통과 (chat/regenerate에 대한 테스트 없음 — 추후 SSE 테스트 추가 검토)
- ⏸ 브라우저 실측: 첫 delta 지연 / 누적 텍스트 정확성 / Gemini와 Claude 모두 / 재생성 / 에러 시 partial 저장 / abort 시 partial 저장

**잔여**:
- 페이지 이탈 시 호출자 측 AbortController로 stream 명시적 중단 (현재 백엔드 `req.on('close')` 자동 감지에 의존)
- SSE 테스트 (jest로 supertest + fake 모델 응답 mock)

---

### 2026-05-27 (Day 7) — Auth (login / signup / forgot / reset-password)

**작업 범위**: 인증 4종 (`/login` 안에 login / register / forgot 뷰 토글 + 별도 `/reset-password?token=`).

**원본 대응**: index.html L869~988 (#screen-login, #screen-reset-password) + app.js submitLogin / submitRegister / submitForgotPassword / submitResetPassword + routes/auth.js (검증 메시지 1:1 매칭).

**구현**:
- `web/app/styles/forms.css` 보강 — auth 패턴 (field-error / field-feedback / auth-switch / btn-text-link / auth-desc / at-input-wrap / at-prefix / reset-done-*)
- `web/lib/validators.ts` 신규 — validateEmail / validatePassword / validateNickname / validateUsername / safeRedirect (open-redirect 방지)
- `web/app/login/page.tsx` + `.module.css` — 통합 화면:
  - **Login view**: identifier (이메일 또는 @아이디) + 비밀번호 → POST /api/auth/login
  - **Register view**: 이메일 + 비밀번호 + 닉네임 + @아이디 → POST /api/auth/register. **debounced username 가용성 체크** (400ms, GET /api/auth/check-username)
  - **Forgot view**: 이메일 → POST /api/auth/forgot-password. dev 응답에 `_demo_token` 있으면 토큰으로 바로 이동 버튼 노출.
- `web/app/reset-password/page.tsx` + `.module.css` — 토큰 기반 비밀번호 변경:
  - URL `?token=<token>` 필수 (없으면 안내 + /login 링크)
  - 새 비밀번호 + 확인 → POST /api/auth/reset-password → done 뷰 → "로그인하러 가기"

**redirect 보안**:
- `?redirect=<path>` 파라미터 그대로 push하지 않음
- `safeRedirect(redirect)` — `/` 시작 안 하거나 `//` 시작 (protocol-relative)이면 `/`로 폴백
- 로그인 성공 시 `router.replace` 사용 — /login을 history에서 제거 (L-011)

**모바일 인터랙션**:
- 모든 input `font-size: 16px` (iOS 줌인 방지)
- @ prefix input의 input도 동일 처리
- 텍스트 링크 버튼 touch-action: manipulation + :active 피드백

**ML-004 재발 방지**:
- `useSearchParams` 사용하는 /login, /reset-password 둘 다 Suspense outer + inner 패턴 적용

**Splash 게이팅**:
- 두 페이지 모두 마운트 즉시 setAppReady(true) — 데이터 게이팅 필요 없음

**범위 제외 (다음 단계)**:
- 회원 정보 수정 (마이페이지의 PATCH /api/auth/me) — Day 8 mypage
- 회원 탈퇴 (DELETE /api/auth/me) — Day 8 mypage
- 성인 인증 모달 (POST /api/auth/adult-verify) — Day 8 mypage 또는 별도

**종료 체크**:
- ✅ type-check 통과
- ✅ build 통과 (`/login` 5.99 kB / 93.4 kB, `/reset-password` 4.57 kB / 91.9 kB — 둘 다 static)
- ✅ 백엔드 jest 49/49 통과
- ⏸ 실제 회원가입/로그인 동작 (DB 변경 동반) — 브라우저 수동 QA
- ✅ AuthGate의 `/login` redirect 404 구멍 해소

**체크리스트 진척**:
- ✅ 섹션 2.7 (Login)
- ✅ 섹션 2.8 (Signup — login 안에 통합)
- ✅ 섹션 2.9 (Forgot password — login 안에 통합)
- ✅ 섹션 2.10 (Reset password — 별도 라우트)

---

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
- 🟡 섹션 2.6 (채팅 1차 — **의도적 미완료**, Codex F5 지적 반영)
  - ✅ 메시지 송수신 / 재생성 / 모델 전환 / 모드 토글
  - ⛔ 기존 세션 로드 (`/history` 또는 직접 URL 진입) — chatPrep store가 in-memory zustand만 사용. 새로고침/직접 URL/뒤로가기 시 prep 없어서 /persona로 redirect. 진정한 완성은 sessionId를 URL param이나 sessionStorage로 옮기고 chat 페이지에서 messages를 백엔드에서 다시 불러와야 함 (Day 9 history와 통합 예정).
- ⛔ 노트 모달 (Day 6.x)
- ⛔ 캐릭터 프로필 모달 (Day 6.x)

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

### ML-014 — 라우트 인증 정책을 시작 단계에서 매트릭스로 정의하고 hook으로 일관 적용
- **증상**: 마이그레이션 중 매 페이지 만들 때마다 임시방편으로 AuthGate 적용. `/mypage`에만 inline 가드 있고 `/character/[id]/chat`, `/history`, `/persona/*`은 비로그인도 통과 → 사용자가 "왜 로그인 안 하고 채팅이 되지?" 발견.
- **원인**:
  1. 마이그레이션 시작 시 **라우트별 인증 정책 매트릭스를 안 만듦**
  2. 백엔드는 guest_id 기반으로 게스트 흐름 지원 (원본 SPA 동작) — 그래서 프론트 가드 없으면 동작은 됨 (보안은 OK)
  3. 사용자 의도는 "채팅/히스토리/페르소나 모두 로그인 필수"였는데 명문화하지 않고 진행
- **올바른 진행 절차** (마이그레이션 시작 시):
  1. 모든 라우트 나열 + public/login-required 라벨링 (사용자와 합의)
  2. `useRequireAuth(intendedPath, opts)` 같은 공통 훅 만들기
  3. login-required 페이지마다 mount 시점에 훅 호출 + 비로그인이면 빈 화면 + AuthGate
  4. `intendedPath`로 로그인 후 복귀 (L-011 패턴 통합)
- **현재 적용된 정책** (Day 8.1 시점):
  | 라우트 | 인증 |
  |---|---|
  | `/`, `/character/[id]`, `/explore`, `/login`, `/signup`, `/reset-password` | public |
  | `/persona`, `/persona/new`, `/persona/select`, `/persona/select/[id]` | login required |
  | `/character/[id]/chat` | login required |
  | `/history` | login required |
  | `/mypage` | login required |
  | `/notification`(TBD), `/builder/*`(TBD) | login required (예정) |
- **체크리스트 (새 라우트 추가 시)**:
  - [ ] 이 라우트는 public인가 login required인가? 사용자와 확인
  - [ ] login required면 `useRequireAuth` 호출
  - [ ] `intendedPath`가 query params 포함하는지 (예: `?session=`, `?char=`) 확인
  - [ ] 비로그인 상태에서 빈 화면 렌더 (AuthGate가 띄워주는 동안)
- **출처**: Day 8.1 직후 사용자 지적 (2026-05-28)

---

### ML-013 — Codex/외부 QA 리뷰의 finding은 보안 critical이라도 무비판적으로 묶음 적용 금지
- **증상**: Codex R4 리뷰 5건 중 F1(critical 보안)에 묻혀 F2(builder requireAuth)와 F4(API shape 변경)를 동시 반영. 결과적으로 데모/포트폴리오 흐름(비로그인 빌더 체험)이 깨지고 `/api/characters/:id` 응답 형태와 사용처가 함께 바뀌어 영향 범위가 커짐.
- **원인**:
  1. critical finding을 빠르게 막아야 한다는 압박감 → 동일 리뷰의 다른 finding도 같은 우선순위로 처리
  2. 각 finding의 의도된 UX·API 정책과의 충돌을 검토하지 않고 일괄 적용
  3. CLAUDE.md의 "반박·수정 정책" (사용자 제시 코드/계획에 문제 있으면 반박 후 진행) 무시
- **올바른 진행 절차**:
  1. 리뷰 finding을 severity와 영향 범위로 **분리**해서 검토
  2. **보안 critical만 즉시 반영** (의도된 UX 영향 없는 경우)
  3. UX/API 정책 변경을 동반하는 finding은 **반박 → 대안 의논 → 사용자 확정 → 적용**
  4. 의도된 게스트 흐름, 데모 모드, 백워드 호환성을 점검 체크리스트로 갖고 있을 것
- **체크리스트 (Codex/외부 리뷰 반영 전)**:
  - [ ] 이 finding이 데모/체험 모드를 막는가? → 그렇다면 rate-limit 등 대안 검토
  - [ ] API 응답 shape를 바꾸는가? → 가능하면 게이트만 추가하는 가벼운 대안 우선
  - [ ] 기존 게스트 흐름을 깨는가? → guest_id 기반 처리 가능한지 확인
  - [ ] 새 라우트 가드가 다른 흐름에서 401을 만드는가? → 호출자 측 영향 분석
- **사례 fix**: F2는 롤백 + apiLimiter 의존, F4는 sessions embed 대신 `/api/characters/:id`에 직접 게이트 (adult_only일 때만, session-ownership 통과)
- **참조**: production lesson 후보. docs/LESSONS.md의 "외부 리뷰/제3자 의견 반영 절차"로도 등재 가치 있음.
- **출처**: Day 8 시작 직전 (2026-05-28)

---

### ML-012 — Node Express SSE에서 `req.on('close')`는 abort 신호로 쓸 수 없음 — `res.on('close')` 써야 함
- **증상**: SSE 엔드포인트 (`POST /api/chat`)에서 응답 헤더만 도착하고 데이터 byte 0개. 백엔드 로그는 모델 응답 정상 수신 + 22개 이벤트 처리 + 348자 완성됐다고 표시. 그런데 클라이언트엔 한 글자도 안 옴.
- **원인**: 첫 번째 abort 가드 코드를 `req.on('close', () => aborted = true)`로 작성. Node.js HTTP에서 `req.on('close')`는 **클라이언트 연결 종료가 아니라 request body 다 읽힌 직후에도 발화**. POST body가 작아 즉시 다 읽혀 → 모델 응답 도착 전에 `aborted = true` → 모든 `onDelta` 콜백이 `if (aborted) return`으로 skip → res.write 한 번도 호출 안 됨.
- **검증**:
  ```js
  console.log('[onDelta]', deltaCount, 'aborted:', aborted, 'text:', text);
  // 결과: aborted가 첫 delta부터 true
  ```
- **해법**: `res.on('close')` 사용. `res.on('close')`는 `res.end()` 호출 전에 underlying 연결이 끊겼을 때만 발화 → 정확히 "클라이언트가 진짜 중간에 끊었다"는 의미.
  ```js
  let aborted = false;
  res.on('close', () => { if (!res.writableEnded) aborted = true; });
  ```
  `res.writableEnded` 체크로 정상 종료 후 fire는 무시.
- **원칙**: Express에서 SSE/long-polling을 만들 때 **클라이언트 abort 감지는 `res.on('close')`** 또는 `req.on('aborted')`. `req.on('close')`는 의미 다름 — 사용 금지.
- **참조**: production lesson 후보. Express + SSE 패턴은 다른 long-poll API에서도 재발 가능.
- **출처**: Day 6.x 스트리밍 (2026-05-28)

---

### ML-011 — StrictMode에서 "한 번만 실행" 가드는 useState 아닌 useRef로
- **증상**: 페르소나 setup → "대화 시작" → chat 페이지 진입했다가 즉시 /persona로 다시 리다이렉트되는 무한 루프. 사용자가 입력은 다 했는데 화면은 "안 됨"으로 인지.
- **원인**: chat 페이지가 `useChatPrepStore.consume()` 호출로 prep을 받아오는데, **React 18 StrictMode (dev)에서 useEffect가 두 번 실행됨**:
  1. 1차 effect: hasPersona=null → consume() → prep 받음, store 비움 → setHasPersona(true)
  2. StrictMode가 cleanup+remount 시뮬레이션 — **그러나 effect closure의 hasPersona는 여전히 null** (state update가 같은 effect 사이클 안에 반영 안 됨)
  3. 2차 effect: hasPersona=null로 보고 또 consume() 호출 → store는 이미 비었으므로 null 반환 → setHasPersona(false) → redirect 트리거
- **검증 방법**: `console.log('[FOLIO][chat] consume effect', { hasPersona })` 박아두면 dev에서 두 번 찍히는 게 보임. 두 번째 호출이 stale closure로 들어옴.
- **해법**: useState 가드 대신 **`useRef` 가드** 사용. ref는 closure 영향 없이 실행 시점에 평가됨.
  ```tsx
  const consumedRef = useRef(false);
  useEffect(() => {
    if (consumedRef.current) return;  // ✓ ref는 항상 최신값
    if (isLoading) return;
    consumedRef.current = true;
    // ... consume ...
  }, [...]);
  ```
- **원칙**: **"한 번만 실행되어야 하는 부수효과" (consume, init API, analytics fire 등)는 항상 useRef 가드.** useState로 가드하면 StrictMode에서 한 번 더 실행됨.
- **참조**: production lesson으로도 등재 가치 — `docs/LESSONS.md` 추가 검토 대상.
- **출처**: Day 6 fix (2026-05-27)

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
