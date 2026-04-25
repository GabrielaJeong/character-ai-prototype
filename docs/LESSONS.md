# LESSONS.md

> Folio 프로젝트의 실수 패턴과 재발 방지 규칙.
> 세션 시작 시 반드시 확인할 것.

## 포맷

```
## L-XXX: 패턴 제목
**날짜**: YYYY-MM-DD
**위험도**: 낮음 / 중간 / 높음
**발생 맥락**: 언제 어떻게 발생했는가
**재발 이유**: 왜 막지 못했는가
**해결**: 즉각 대응
**강화 규칙**: 재발 방지를 위한 체크리스트
```

---

## L-001: API 응답 객체에 DB 컬럼 누락

**날짜**: 2026-04-05 (초기 발견), 2026-04-20 (재발), 2026-04-21 (재발)
**위험도**: 높음 (프론트에서 잘못된 결과 표시)

**발생 맥락**:
- `GET /api/sessions`에서 `character_id` 필드 누락 → '이화' 하드코딩 fallback 출력
- `GET /api/sessions/:id`에서도 동일 누락 (list/detail 각각 별도 매핑)
- `listSessions` SQL에 `safety` 컬럼 미포함 → undefined 전달
- v0.20 크리에이터 시스템에서 `owner_username` 필드 누락 (재발)

**재발 이유**:
- list / detail / SQL SELECT 3곳이 분리되어 있어 한 곳만 수정하기 쉬움
- DB 컬럼 추가 시 영향 범위 전수 검토 안 함

**해결**: 응답 객체에 필드 추가, SQL SELECT 수정.

**강화 규칙**:
1. DB 컬럼 추가/변경 시 체크리스트:
   - [ ] `db/index.js`의 prepared statement SELECT 확인
   - [ ] 해당 컬럼을 사용하는 모든 route의 list 엔드포인트 응답 객체 확인
   - [ ] 해당 컬럼을 사용하는 모든 route의 detail 엔드포인트 응답 객체 확인
2. 하드코딩 fallback 값 금지 (디버깅 어려움) → 에러 로깅으로 대체
3. 새 API 엔드포인트 추가 또는 응답 필드 변경 시
   대응하는 테스트 작성 필수 (`tests/api/*.test.js`)
4. 해당 테스트는 list와 detail 엔드포인트의 필드
   동기화를 반드시 포함

### 재발 방지 검증 사례 (2026-04-21)
- `tests/api/sessions.test.js` 작성 중 `routes/sessions.js`의
  `GET /:id` 응답에 `safety`, `model`, `message_count` 필드 누락 발견
- LESSONS.md 작성 당시 예시로만 언급했던 버그가 실제로 코드에 남아있었음
- 테스트 세팅이 실제 버그를 자동 감지 (하네스 엔지니어링 효과 검증)
- 수정: `routes/sessions.js` 응답 객체에 3개 필드 추가

---

## L-002: Config ↔ Source drift

**날짜**: 2026-04-21
**위험도**: 중간 (캐릭터 신뢰도 저하)

**발생 맥락**:
- 이화 캐릭터 `config.json`의 `notes.rules`에 "그녀는 존댓말을 쓰지 않는다" 기록
- 실제 `system.md`에는 "기본은 존댓말이다" 명시
- 두 파일이 독립적으로 작성되어 내용이 어긋남

**재발 이유**:
- `config.json` 작성 시 `system.md`를 참조하지 않고 재해석
- 캐릭터 추가 시마다 같은 패턴 반복 가능성

**해결**: 이화 notes를 system.md Block 2 기반으로 재작성.

**강화 규칙**:
1. `config.json`의 `notes` 작성 시 반드시 `system.md`를 먼저 읽을 것
2. `notes.rules`는 system.md의 "관찰 가능한 캐릭터 특성" 섹션만 발췌
3. 새 캐릭터 추가 시 체크리스트:
   - [ ] `system.md` 작성 완료
   - [ ] `config.json`의 notes가 system.md 내용과 일치하는가?
   - [ ] 프롬프트 엔지니어링 파라미터(길이, 가드레일 등) 공개 금지 위반 없는가?

---

## L-003: Static HTML + JS renderer 충돌

**날짜**: 2026-04-21
**위험도**: 중간 (기능 완전 미노출)

**발생 맥락**:
- 마이페이지 "새 페르소나 만들기" 버튼이 안 보임
- HTML에 정적으로 배치한 요소가 JS의 `innerHTML` 전체 교체 방식 렌더러에 의해 삭제됨

**재발 이유**:
- SPA 구조에서 정적 요소와 동적 렌더링 영역의 경계 불명확
- `innerHTML = '...'` 방식이 기존 정적 자식 요소 모두 제거

**해결**: 정적 요소를 JS 내부에서 삽입하도록 수정.

**강화 규칙**:
1. 🚩 Red Flag: HTML에 정적 요소 작성 중 → 이 영역이 JS `innerHTML` 교체 대상인가?
2. 컨테이너 요소에 `innerHTML` 전체 교체 사용 시:
   - [ ] 해당 컨테이너 내부의 모든 정적 HTML 요소 확인
   - [ ] 정적 요소가 있다면 JS 렌더러 안에 통합
3. 대안: `appendChild`나 `insertAdjacentHTML`로 교체 범위 축소 고려

---

## L-004: 프롬프트 엔지니어링 노하우 공개 위험

**날짜**: 2026-04-21
**위험도**: 높음 (경쟁 우위 상실 + 어뷰징 가능)

**발생 맥락**:
- 캐릭터 프로필 NOTES 탭의 `RULES.nnn` 섹션에 프롬프트 규칙 전체 노출 위험
- `config.json`의 notes 작성 시 `system.md`의 가드레일·모델별 보정 전략을 그대로 공개할 가능성

**재발 이유**:
- UI 레퍼런스(Character.AI 등)를 참고하면서 공개 범위 고민 없이 복사
- 공개 가능 항목과 금지 항목의 기준 불명확

**해결**: NOTES 공개 범위 기준 명확화 + system.md 기반으로만 notes 작성.

**강화 규칙**:

### `config.json`의 `notes.rules` / `notes.creator_note` 공개 가능 항목
- ✅ 관찰 가능한 캐릭터 특성 (말투, 습관, 리듬)
- ✅ 크리에이터의 창작 의도 (분위기, 감정선)
- ✅ 독자 가이드 (첫 대화 팁, 페이싱 조언)

### 공개 금지 항목
- ❌ 프롬프트 길이/형식 파라미터 (예: "1000~2000자 유지")
- ❌ 가드레일 목록 (금지 표현, Safety 정책)
- ❌ 모델별 보정 전략 (가설 2의 실험 결과)
- ❌ Safety 방어 단계 구조

### 체크리스트
- [ ] notes 작성 시 "이 규칙이 경쟁사에 복사되면 문제가 되는가?" 자문
- [ ] "유저가 이 규칙을 역이용해 캐릭터 조작을 시도할 수 있는가?" 자문
- [ ] 두 질문 중 하나라도 Yes면 공개 금지
- [ ] 기존 4개 프리빌트 캐릭터의 notes는 `system.md`의 프롬프트 규칙을
     그대로 복사하지 말고 "독자 관점에서 관찰 가능한 특성"으로 재작성

---

## L-005: 역할 체크 단일 필드 의존

**날짜**: 2026-04-21
**위험도**: 낮음 (현재 어드민 1명이라 실사용 영향 없음)

**발생 맥락**:
- CREATOR 배지가 `username === 'admin'`만 체크, `role === 'admin'` 누락
- 향후 어드민 계정이 늘거나 username이 'admin'이 아닌 어드민 생성 시 배지 미표시

**재발 이유**:
- 빠른 구현을 위해 하드코딩된 username 비교 사용
- 역할 기반 분기의 표준 패턴 미확립

**해결**: `role === 'admin'` 기준으로 변경.

**강화 규칙**:
1. 🚩 Red Flag: `username === '...'` 또는 `email === '...'`로 역할 체크 중
   → `role` 필드 기반으로 변경
2. 역할 기반 분기 표준:
   - 어드민: `user.role === 'admin'`
   - 크리에이터: `character.owner_username` 존재 여부
   - 본인 여부: `currentUser.username === target.username`
3. 새 권한 체크 추가 시 `users.role` 컬럼의 enum 확장 고려

---

## L-006: 버전 번호 중복 기록

**날짜**: 2026-04-20
**위험도**: 낮음 (혼란만 유발)

**발생 맥락**:
- 크리에이터 시스템 작업을 v0.19로 기록 후 v0.20으로도 중복 기록
- 거의 동일한 내용이 두 엔트리로 존재

**재발 이유**:
- 작업 세션 분할 시 이전 버전 번호 확인 누락
- CHANGELOG 업데이트 타이밍 불명확

**해결**: v0.19 엔트리 삭제, v0.20으로 통합.

**강화 규칙**:
1. CHANGELOG 업데이트 시 체크리스트:
   - [ ] 현재 최신 버전 번호 확인 (최상단)
   - [ ] 새 버전이 연속된 번호인가?
   - [ ] 동일 작업이 이전 버전에 이미 기록되어 있지 않은가?
2. 버전 번호 부여 원칙:
   - 기능 추가/중요 변경: minor 증가 (v0.X+1)
   - 버그 수정만: patch 증가 (v0.XX.Y)
   - 작업 단위당 1개 버전 (분할 기록 금지)
   - **커밋 단위로 버전 부여 금지** — 논리적 작업 단위당 1개 버전
3. update-changelog.js 자동화 규칙:
   - `[release]` 태그가 없는 커밋은 CHANGELOG 자동 생성 건너뜀
   - 작업 완료 시점의 최종 커밋 메시지에만 `[release]` 포함
   - 예: `git commit -m "v0.22: 테스트 인프라 구축 [release]"`

---

## L-007: escapeHtml 미적용 — innerHTML 유저 입력 XSS

**날짜**: 2026-04-23
**위험도**: 높음 (유저 생성 콘텐츠 XSS 가능)

**발생 맥락**:
- 채팅 메시지(`escapeHtml(text)`)와 세션 미리보기(`escapeHtml(session.last_message)`)는 이스케이프 적용
- 캐릭터 이름·태그·역할, 닉네임·아이디·이메일, 페르소나 이름, input value 속성은 미적용
- 유저 빌더로 생성한 캐릭터(`char_` prefix)는 name·role·tags가 완전히 유저 입력값

**재발 이유**:
- `textContent` 사용처는 안전하나 `innerHTML` 템플릿 리터럴과 혼용해 경계 불명확
- escapeHtml이 파일 하단에 정의되어 "이미 있다"는 인식 부족

**해결**: `escapeHtml()` 5종 이스케이프(`&`, `<`, `>`, `"`, `'`)로 강화 + innerHTML 10개소 적용.

**강화 규칙**:
1. 🚩 Red Flag: 템플릿 리터럴 `innerHTML` 안에 `${변수}` 삽입 중
   → 이 값이 유저 입력(DB 저장값 포함)인가? → 맞으면 `${escapeHtml(변수)}`
2. 안전한 것: `textContent`, `setAttribute('alt', ...)` 직접 할당
3. `value="${...}"` 속성도 `"` 포함 시 attribute injection → `escapeHtml` 필수
4. 신규 렌더링 함수 추가 시 체크리스트:
   - [ ] innerHTML 사용하는가?
   - [ ] 삽입 데이터가 서버 응답(유저 입력 가능성)인가?
   - [ ] escapeHtml 거치는가?

---

## L-009: helmet CSP 기본값 `script-src-attr: none` — onclick 전면 차단

**날짜**: 2026-04-23
**위험도**: 높음 (프로덕션 클릭 이벤트 전체 불능)

**발생 맥락**:
- helmet에 커스텀 `directives`를 지정해도 helmet의 기본 directives가 **병합**됨
- 기본값 `script-src-attr: 'none'`이 HTML 속성 이벤트 핸들러(`onclick="..."` 등)를 전부 차단
- `scriptSrc`에 `'unsafe-inline'`이 있어도 `scriptSrcAttr`는 별개 디렉티브라 효과 없음
- app.js 전체에 `onclick=` 인라인 핸들러가 수십 개 → 프로덕션 전체 클릭 불능

**재발 이유**:
- helmet 기본 병합 동작을 인지하지 못함
- 로컬 브라우저 캐시로 인해 재현 안 됨 (헤더가 캐시에서 미적용)

**해결**: `scriptSrcAttr: ["'unsafe-inline'"]` 명시적 추가.

**강화 규칙**:
1. 🚩 Red Flag: helmet CSP 커스텀 `directives` 설정 중
   → `script-src-attr` 포함 여부 확인 (`'none'`이 기본값으로 병합됨)
2. helmet 기본 directives 목록 주요 항목:
   - `script-src-attr: 'none'` — onclick 등 속성 이벤트 핸들러 차단
   - `object-src: 'none'` — Flash 등 차단
   - `base-uri: 'self'` — base 태그 제한
3. 커스텀 CSP 배포 후 체크리스트:
   - [ ] 브라우저 DevTools → Console에서 CSP 위반 오류 확인
   - [ ] 클릭/입력 이벤트 동작 수동 확인

---

## L-008: 역방향 프록시 환경에서 rate limiter IP 오인식

**날짜**: 2026-04-23
**위험도**: 높음 (프로덕션 전체 클릭 이벤트 불능)

**발생 맥락**:
- Railway 배포 후 모든 클릭/API 호출이 429로 막힘
- `express-rate-limit` 추가 직후 발생
- Railway는 역방향 프록시 구조 → 모든 요청의 `req.ip`가 프록시 내부 IP 하나로 집계
- 200회/15분 한도를 전체 유저가 공유하여 즉시 소진

**재발 이유**:
- 로컬에서는 프록시 없이 직접 접속하므로 문제 재현 안 됨
- rate limiter 설정 시 프록시 환경 고려 누락

**해결**: `app.set('trust proxy', 1)` 추가 → `X-Forwarded-For` 헤더로 실제 클라이언트 IP 사용.

**강화 규칙**:
1. 🚩 Red Flag: rate limiter 또는 IP 기반 로직 추가 중 + 프록시 뒤 배포 환경
   → `app.set('trust proxy', 1)` 설정 여부 확인
2. Railway / Heroku / Nginx 프록시 뒤에서는 항상 trust proxy 필수
3. 로컬 테스트만으로는 재현 불가 — 배포 직후 rate limit 동작 수동 확인

---

## L-010: UUID 세션 ID를 소유권 증명으로 오인 — Security Through Obscurity

**날짜**: 2026-04-23
**위험도**: 높음 (타 유저 세션 무단 접근·수정 가능)

**발생 맥락**:
- 세션 UUID는 추측하기 어렵지만 알게 되면 누구나 접근 가능 (로그 유출, 어깨너머 등)
- `GET /api/sessions/:id`, `PUT /:id/safety`, `POST /api/chat`, `POST /api/chat/regenerate`, `GET|PUT /api/sessions/:id/note` — 소유권 미검증
- 게스트 세션 목록 `GET /api/sessions`이 `guest_id` 없이 전체 게스트 세션 반환

**재발 이유**:
- UUID가 "어차피 모름" → 인증 불필요로 잘못 인식
- 세션 표에 `user_id`는 있었으나 guest 구분 컬럼 부재

**해결**:
- `sessions` 테이블에 `guest_id TEXT` 컬럼 추가 (마이그레이션 try/catch)
- `createSession` 7번째 파라미터로 guestId 저장
- server.js에 guestId 자동 발급 미들웨어 추가 (비로그인 세션 최초 요청 시)
- `lib/sessionOwnership.js` — `verifyOwnership()` 헬퍼로 로그인/게스트 양쪽 소유권 검증
- `GET /api/sessions`는 게스트의 경우 `stmt.listSessionsByGuest.all(guestId)`로 격리

**강화 규칙**:
1. 🚩 UUID를 알면 접근 가능한 리소스 라우트 → `verifyOwnership()` 또는 동등 검증 필수
2. 게스트 접근 허용 리소스라도 "누구나"가 아니라 "해당 게스트만" 원칙
3. `createSession` 호출 위치 추가 시 guestId 7번째 인자 전달 확인

---

## L-012: 모바일 인터랙션 전반 미고려 — 다수 버튼 미동작

**날짜**: 2026-04-23
**위험도**: 높음 (핵심 플로우 버튼들 iOS Safari에서 반응 없음)

**발생 맥락**:
- `<button onclick="...">` 요소임에도 iOS Safari에서 뒤로가기·MARK ALL 등 다수 버튼 미반응
- 300ms 클릭 딜레이: iOS는 더블탭 감지를 위해 탭 후 300ms 대기. `touch-action: manipulation` 없으면 유저가 탭해도 반응 없는 것처럼 느껴짐
- 소형 터치 타겟: `.notif-back-btn`(~18px), `.btn-back`(~24px), `.notif-mark-all-btn`(~23px) — iOS 권장 최소 44px 미달
- `:active` 피드백 없음: `:hover` 만 있어 터치 시 시각 피드백 없음 → "눌렸는지 모름"

**해결**:
- `button, a { touch-action: manipulation }` 전역 적용으로 300ms 딜레이 제거
- 소형 버튼 `min-height: 44px` + `display: flex; align-items: center` 적용
- `button:active { opacity: 0.65 }` 전역 + 주요 div/span 인터랙티브 요소 `:active` 추가
- `touch-action: pan-x` 컨테이너(explore-tag-bar, creator-row, genre-row) 내 자식에 `manipulation` 명시

**강화 규칙**:
1. 🚩 새 버튼/인터랙티브 요소 추가 시 3종 체크: `touch-action: manipulation` / `min-height: 44px` / `:active` 피드백
2. iOS Safari 수동 검증 필수 (Chrome DevTools 모바일 에뮬레이션 ≠ 실기기)
3. 터치 딜레이는 마우스 클릭 테스트로 재현 불가 — 실기기 또는 Safari 원격 디버깅으로만 확인 가능

---

## L-011: 인증 게이트 → 로그인 → 뒤로가기 무한 루프

**날짜**: 2026-04-23
**위험도**: 높음 (핵심 UX 파괴, 탈출 불가)

**발생 맥락**:
- `/mypage` 등 인증 필요 경로 → `showAuthGate()` → 유저가 "로그인하기" 클릭
- `navigateTo('/login')` (pushState) → history: [..., /mypage, /login]
- 로그인 화면에서 뒤로가기 → `/mypage` → 비로그인 → auth gate 재발동 → 루프
- 추가로: 버튼 onclick이 `_authGateIntendedPath=null`로 초기화 → 로그인 성공 후 `/`로 이동 (의도한 경로 소실)

**해결**:
- `goToLogin()` 함수: `replaceState`로 `/mypage` 기록을 `/login?redirect=%2Fmypage`로 교체 → 뒤로가기 시 `/mypage` 기록 없음
- `_authGateIntendedPath` null 처리를 `goToLogin()` 진입 시 수행 → `closeAuthGate`의 `navigateTo('/')` 오발 방지
- `submitLogin`/`submitRegister`: `redirect` URL 파라미터 우선 읽기, `replaceState` + `renderRoute`로 `/login?redirect=...` 기록도 제거

**강화 규칙**:
1. 🚩 Red Flag: 인증 필요 화면에서 `/login` 이동 핸들러 작성 중
   → `pushState` 대신 `replaceState` 사용 여부 확인
2. 로그인 성공 후 복귀 경로: URL `redirect` 파라미터 → `_authGateIntendedPath` → `/` 우선순위로 처리
3. `redirect` 파라미터는 반드시 `/` 시작 검증 (open redirect 방지)
4. `closeAuthGate`에 side-effect(`navigateTo('/')`)가 있으므로, 직접 모달 닫기 전 `_authGateIntendedPath` 상태 관리 필수
5. 라우팅 플로우 변경 시 반드시 뒤로가기 시나리오 수동 테스트

---

## 사용 가이드

### 새 패턴 추가 시
1. L-XXX 번호 순차 부여
2. 포맷 준수 (날짜, 위험도, 맥락, 재발 이유, 해결, 강화 규칙)
3. CLAUDE.md의 "Red Flags" 섹션에 체크리스트 추가 고려

### 세션 시작 시
- 위험도 '높음' 항목 먼저 확인
- 현재 작업이 어느 L 번호와 관련 있는지 판단
- 해당 강화 규칙을 작업 중 지속 확인

### 위험도 기준
- **낮음**: 기능에 영향 없음, 혹은 프로토타입 단계라 허용 가능
- **중간**: 기능 일부 손상 또는 UX 저하
- **높음**: 데이터 손상, 보안 이슈, 경쟁 우위 상실