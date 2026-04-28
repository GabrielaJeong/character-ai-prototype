<!-- changelog-last-commit: a35122deb9e1352b76dc6176ac57e4e4efca874a -->
<!-- changelog-last-version: 0.28 -->

## v0.28 — 2026-04-29
**v0.28 [release] 모바일 버그 수정, CI 안정화, 문서·훅 정비**

### 버그 수정
- CHANGELOG 자동생성 훅 두 가지 버그 수정

### 기타
- v0.28 [release] 모바일 버그 수정, CI 안정화, 문서·훅 정비

---












# Folio — 업데이트 로그

> AI 캐릭터 채팅 플랫폼 프로토타입  
> 기록 기준: Git 커밋 이력

---

## v0.27 — 2026-04-28
**업데이트 자동 알림 시스템 (ReleaseNotify), 포트폴리오 데모 모드 — 로그인 없이 체험하기**

### 주요 기능
- lib/releaseNotify.js: 버전 파싱, AI 문구 생성(Gemini→Anthropic 폴백), DB 삽입
- server.js: 서버 시작 시 checkAndNotify() 비동기 호출
- data/release-notify.json: 마지막 알림 버전 상태 저장
- GET /api/auth/demo-available: 프론트 버튼 표시 여부
- POST /api/auth/demo-login: 데모 계정 자동 생성 + 세션 발급
- GET /api/auth/me: isDemo 필드 추가
- 인증 게이트에 '로그인 없이 체험하기 →' 버튼 (데모 모드일 때만 표시)
- 체험 중 하단 고정 배너 + '체험 종료' 버튼
- 데모 계정: demo@folio.app / nickname: 체험 유저

### 버그 수정
- 마크다운 코드블록 제거 후 직접 JSON.parse, 실패 시 indexOf/lastIndexOf로 추출
- maxTokens 200→1024: Gemini thinking 토큰 여유 확보 (기존엔 JSON 중간에 잘림)
- data/release-notify.json: v0.26 알림 완료 상태 저장
- 비로그인 또는 role != admin → / 리다이렉트
- admin.html/admin.js 소스 비인가자 노출 차단
- 어드민 계정 탈취 시 대량 데이터 추출 차단

### UI
- 어드민 대시보드 그래프 2열 병렬 배치

### 기타
- v0.27 [release] 데모 모드, 어드민 보안, 장기기억, 자동 알림

---

## v0.26 — 2026-04-27
**캐릭터 장기기억(Long-term Memory) 구현**

### 문서
- D-013 환경 분리 전략 결정사항 추가
- DESIGN_SYSTEM.md 신규 생성
- Git 브랜치 전략 추가 (dev 브랜치 운영 정책)
- D-014 React 마이그레이션 보류 결정 및 준비 전략 기록

### 버그 수정
- NEW/UP 배지 텍스트 상단 쏠림 수정
- iOS Safari 네비바 미표시 — 100vh → 100dvh
- -webkit-tap-highlight-color: transparent 전역 적용 (iOS 탭 회색 플래시 제거)
- iOS input 자동 줌인 방지: @supports(-webkit-touch-callout) 조건으로 font-size: 16px
- notif-tabs overflow-x: auto 추가 (탭 슬라이드 불가 버그 수정)
- creator-row, genre-row, explore-tag-bar: touch-action: pan-x + -webkit-overflow-scrolling: touch
- initDragSlider: touchstart/touchmove/touchend 이벤트 추가
- button, a { touch-action: manipulation } 전역 적용 (300ms 딜레이 제거)
- 소형 버튼 44px 터치 타겟 확보: notif-back-btn / btn-back / notif-mark-all-btn / notif-tab
- button:active { opacity: 0.65 } 전역 + div/span 인터랙티브 요소 :active 추가
- explore-tag-chip, creator-card, genre-card: touch-action: manipulation 명시 (pan-x 충돌 방지)
- explore-tag-chip: min-height: 44px 추가
- docs/CONVENTIONS.md: 모바일 3종 체크리스트 추가
- docs/LESSONS.md: L-012 추가
- CLAUDE.md: Red Flags 9-11 추가, 반박·수정 정책 명시
- 캐릭터 상세 페이지 이미지 스크롤 개선
- 캐릭터 상세 이미지 스크롤 수정 — flex-shrink: 0 복구
- 캐릭터 상세 스크롤 — intro-wrapper로 명시적 scroll container 분리
- 포트폴리오 iframe 임베딩 허용

### 주요 기능
- db/index.js: memories 테이블 추가 (user_id × character_id unique)
- lib/memory.js: generateMemory() — 이전 세션 메시지 요약 후 저장
- buildSystemPrompt.js: memory 파라미터 추가
- routes/chat.js: 새 세션 시작 시 기존 기억 로드 + 백그라운드 재생성
- tests: X-Frame-Options → frame-ancestors CSP 검증으로 업데이트

### 리팩터링
- Gemini 세션 → gemini-2.5-flash 요약, 실패 시 claude-haiku 폴백
- Anthropic 세션 → claude-haiku 요약, 실패 시 gemini-2.5-flash 폴백
- generateMemory에 sessionModel 파라미터 추가
- API 키 미설정 시에도 반대쪽 제공사로 자동 폴백

### 기타
- v0.26 [release] 장기기억 + iframe 임베딩 + 모바일 호환성 개선

---

## v0.25 — 2026-04-23
**v0.25 [release] 인증 게이트 루프 수정 및 보안 패치**

### 버그 수정
- CI 환경 SESSION_SECRET 하드코딩 → 환경변수 참조로 수정
- goToLogin(): replaceState로 /mypage를 /login?redirect=... 로 교체
- _authGateIntendedPath를 goToLogin() 진입 시 null 처리
- submitLogin/submitRegister: redirect URL 파라미터 우선 읽기,
- index.html: auth gate 버튼 onclick → goToLogin()으로 교체
- docs: L-011 추가

### 기타
- v0.25 [release] 인증 게이트 루프 수정 및 보안 패치

---

## v0.24 — 2026-04-23
**v0.24 [release] 세션 소유권 검증 + 게스트 세션 격리 보안 패치**

### 버그 수정
- trust proxy 설정 추가 — Railway 프록시 뒤 rate limit IP 오인식 수정
- CSP scriptSrcAttr 추가 — helmet 기본값이 onclick 속성 전부 차단하던 문제 수정

### 문서
- LESSONS.md L-008 추가 — 역방향 프록시 rate limit IP 오인식
- CLAUDE.md Red Flags에 rate limit trust proxy 항목 추가 (L-008)
- SECURITY.md CSP 정책 표 추가, LESSONS.md L-009 추가
- CLAUDE.md Red Flags에 CSP scriptSrcAttr 항목 추가 (L-009)

### 기타
- lib/sessionOwnership.js: verifyOwnership() 헬퍼 신규 추가
- 로그인 유저: user_id 일치 검증
- 게스트: guest_id 일치 + user_id IS NULL 검증
- db/index.js: sessions.guest_id 컬럼 마이그레이션, createSession 7번째 파라미터, listSessionsByGuest 추가
- server.js: randomUUID 임포트, 비로그인 최초 요청 시 guestId 자동 발급 미들웨어
- routes/sessions.js: GET / 게스트 격리, GET|PUT /:id 소유권 검증 적용
- routes/chat.js: 기존 세션 접근 시 소유권 검증, createSession에 guestId 전달
- routes/regenerate.js: 소유권 검증 추가, model 선언 순서 버그 수정
- routes/notes.js: GET|PUT 소유권 검증 적용
- tests: 소유권 테스트 3종 추가 (404/403/200), 총 49개 통과
- docs: L-010 추가, SECURITY.md 세션 소유권 섹션 이동

---

## v0.23 — 2026-04-23
**[release] v0.23: 보안 프레임워크 전면 적용**

### 문서
- docs/ 트리에 CONVENTIONS.md, SESSION_CHECKLIST.md, CURRENT_STATE.md 추가
- config.json 예시: chapter → avg_length, rules string 배열로 수정, notes_by/notes_date 추가
- README 업데이트, DECISION.md → DECISIONS.md 리네임
- D-011 동적 SQL 헬퍼 함수 분리 결정 추가, CONVENTIONS.md 보완

### 리팩터링
- db/index.js: adminDashPV/UV/DAU/MAU, adminCharSessionCount, countBroadcastNotifs stmt 추가
- db/index.js: adminGraphSeries, adminGraphSeriesDistinct, adminModerationFilter 헬퍼 함수 추가 및 export
- routes/admin.js: db.prepare() 직접 호출 7곳 → stmt + 헬퍼로 교체
- 310: charSessionCounts (기존 stmt 재사용)
- 424: getAllMessages (기존 stmt 재사용)
- routes/notifications.js: require('../db').db.prepare() → stmt.countBroadcastNotifs

### 기타
- server.js: helmet(CSP/보안헤더), express-rate-limit(auth 10회/api 200회), cookie secure/httpOnly, 글로벌 에러 핸들러
- app.js: escapeHtml() 5종 이스케이프 강화 + innerHTML 10개소 적용 (닉네임, 아이디, 이메일, 캐릭터명/태그/역할, 페르소나명, input value)
- routes/admin.js: 업로드 base64 크기 5MB 제한
- tests/api/security.test.js: helmet 헤더, rate limit 429, cookie httpOnly 검증 (46개 통과)
- docs/SECURITY.md 신규, DECISIONS.md D-012, LESSONS.md L-007 추가
- .env.example SESSION_SECRET 항목 추가

---

## v0.22 — 2026-04-21
**테스트 인프라 구축 + 하네스 엔지니어링 완성**
- Jest + supertest 설치, 41개 테스트 전체 통과
  - tests/api/ (characters, auth, sessions, creator)
  - tests/unit/buildSystemPrompt
- GitHub Actions CI 구축 (push/PR 자동 실행, 통과 확인)
- routes/sessions.js GET /:id — safety/model/message_count 누락 수정 (L-001 실재 버그)
- server.js — require.main 조건부 listen + module.exports 분리
- ESLint + Prettier + .editorconfig 추가
- 문서 정비
  - CLAUDE.md 코딩 규칙을 CONVENTIONS.md 참조로 축약
  - docs/CONVENTIONS.md, LESSONS.md (L-001~L-006), DECISIONS.md (D-001~D-010) 신규
  - docs/SESSION_CHECKLIST.md, CURRENT_STATE.md 신규
- 커버리지: 전체 34.79%, sessions.js 80%, buildSystemPrompt.js 100%

---

## v0.21 — 2026-04-20
**캐릭터 인트로 리디자인, 마이페이지 개편 (v0.21)**
- 캐릭터 인트로 페이지 전면 리디자인
- 풀블리드 히어로 이미지 + 플로팅 nav
- ROLE·WORLD 라벨, 한/영 이름, CHATS/LIKES 스탯바
- CREATED.BY 섹션 (유저 생성 캐릭터)
- 3탭: ABOUT / NOTES / COMMENTS
- 히어로 우상단: 좋아요·책갈피·더보기 반투명 원형 버튼
- 하단 바: 대화 시작 버튼 풀 너비
- 캐릭터 config에 nameEn / about / notes 필드 추가 (4개 캐릭터)
- 마이페이지 전면 개편
- 프로필 카드: 사각형 유리 테두리 아바타, @id·이메일 한 줄, CREATOR 배지
- 설정 섹션 아이콘 (pencil / shield / user / clock)
- REVENUE.PREVIEW BETA 섹션
- 새 페르소나 만들기 카드형 CTA
- 탭 카운트 뱃지 (99+ 처리)
- 메뉴 리스트 (좋아요·팔로잉·설정·지원·로그아웃)
- 푸터 버전 표시
- 전체 폰트 Pretendard 고정 (monospace 제거)
- SVG 아이콘 파일 추가 (/public/icons/)

---

## v0.20 — 2026-04-20
**회원가입/로그인 개편 및 크리에이터 프로필 시스템 구축**
- 회원가입: @아이디 필드 추가 (영문 소문자·숫자·언더바 3~20자, 실시간 중복 확인)
- 로그인: 이메일 또는 @아이디 모두 지원
- `users` 테이블 `username` 컬럼 추가 (unique partial index, NULL 허용)
- GET /api/auth/check-username: 아이디 사용 가능 여부 확인
- PATCH /api/auth/me: username 변경 지원 (기존 유저 @아이디 설정)
- 마이페이지: @아이디 표시, 내 정보 수정에 @아이디 변경 필드, "크리에이터 프로필 보기" 버튼
- GET /api/creator/:username: 크리에이터 프로필 API (유저 정보 + 제작 캐릭터 목록)
- PATCH /api/creator/:charId/pin: 캐릭터 핀 고정/해제 (owner 전용)
- /creator/@:username: 크리에이터 프로필 화면 (아바타, 닉네임, @아이디, 통계, 작품 목록)
- 캐릭터 카드: 유저 제작 캐릭터에 @username 태그 표시 (클릭 시 크리에이터 프로필 이동)
- owner: "프로필 편집" 버튼 표시, 핀 고정 기능

---

## v0.18 — 2026-04-20
**큐레이션 어드민 고도화 및 UI 개선**
- BROADCAST 배너: 캐러셀 전환, 이미지 업로드, 실시간 미리보기(390px), 히스토리 기록/복원
- EDITOR.PICKS: 이미지 업로드, 실시간 미리보기(390px), 히스토리 기록/복원
- 배너/컬렉션 이미지 레이어 z-index 조정 및 그라데이션 마스크 개선 (오른쪽→선명, 왼쪽→투명)
- TOP.creators / GENRE.catalog: 추후 개발 예정 안내 플레이스홀더로 교체
- TAG.CLOUD 삭제 버튼 인라인 x 버튼으로 소형화
- 어드민 미리보기 너비 390px 고정 (실제 앱 화면 기준)
- 전체 폰트 Pretendard 통일, Inter 제거
- POST /api/admin/upload (base64 이미지 업로드)
- GET/POST/DELETE /api/admin/broadcast-history
- GET/POST/DELETE /api/admin/collection-history

---

## v0.17 — 2026-04-19
**랜딩/탐색 큐레이션 시스템, 어드민 큐레이션 관리 구축**
- 랜딩 페이지: 섹션별 <section> 컨테이너화, 푸터(LEGAL·SUPPORT·사업자정보) 추가
- 탐색 페이지: 큐레이션/랭킹 탭 분리, BROADCAST 배너·TAG.CLOUD·EDITOR.PICKS 추가
- 랭킹: 일간/주간/월간 정렬, TOP 20 더미 데이터
- 장르 슬라이더: 마우스 드래그 슬라이딩 지원
- data/curation.json: 모든 큐레이션 데이터 중앙 관리
- GET /api/curation 공개 엔드포인트로 앱에서 동적 렌더링
- 어드민 큐레이션 관리: 메인홈/탐색 탭 → 섹션별 서브탭 분리
- 어드민 각 아이템에 순번 표시 + 드래그 앤 드롭 순서 변경

---

## v0.16 — 2026-04-19
**알림 시스템 개편, 어드민 알림/배지 관리 기능 추가**
- 알림 카테고리 NOTICE 추가 (메가폰 아이콘, 붉은 태그)
- SOCIAL/SYSTEM/NOTICE 전용 아이콘 SVG 적용
- 읽음/안읽음 기준 네온바, opacity 제거
- NOTICE 5줄 초과 시 더보기 아코디언
- 어드민: 알림 등록/삭제, SOCIAL 제외 NOTICE·SYSTEM만 표시
- 어드민: 캐릭터 badge_override 수동 설정
- 알림 폼 UI 개선 (패딩 통일, 인풋 크기 14px)
- 알림 탭 ALL/SOCIAL/SYSTEM/NOTICE 구성

---

## v0.15 — 2026-04-19
**카드 리디자인, 알림 시스템, 비밀번호 찾기 기능 추가 (v0.14)**
- 캐릭터 카드 구조 변경: 이미지+배지+태그 / 이름+직업+통계 분리
- 상태 배지 (NEW/HOT/UP) 및 넘버링 배지 서버 계산
- RECOMMENDED.feed 섹션 헤더 + ALL/18+ pill 토글
- notifications/notification_reads 테이블 + /api/notifications API
- /notification 화면: 탭 필터, 날짜 그룹, 아코디언, 벨 아이콘 배지
- 북마크 트리거 → SOCIAL 알림 자동 생성
- 비밀번호 찾기: password_reset_tokens + forgot/reset-password API
- 버그 수정: auth-gate 로그인 버튼, 쿼리스트링 라우트 매칭

---

## v0.14 — 2026-04-19
**카드 리디자인, 알림 시스템, 비밀번호 찾기 기능 추가**

### 캐릭터 카드 리디자인
- 카드 구조 변경: 이미지 카드 + 하단 정보 블록 분리
- 넘버링 배지 (#B01~), 상태 배지 (NEW/HOT/UP), 통계 (세션 수/책갈피 수)
- NEW: 등록 7일 이내, HOT: 최근 7일 세션 상위, UP: 프롬프트 7일 내 업데이트
- ALL / 18+ 토글 pill 형태로 변경
- RECOMMENDED.feed 섹션 헤더 + VIEW ALL → 탐색 이동

### 알림 시스템 신규
- notifications, notification_reads 테이블
- API: GET/PATCH /api/notifications (목록, 읽음 처리)
- SOCIAL 알림: 내 캐릭터 책갈피 시 자동 생성
- SYS 알림: 시스템 공지 (전체 유저)
- /notification 화면: 필터 탭 (ALL/SOCIAL/SYS), 날짜 그룹, 아코디언, MARK ALL
- 헤더 벨 아이콘 + 미읽 수 배지

### 비밀번호 찾기
- password_reset_tokens 테이블
- POST /api/auth/forgot-password, POST /api/auth/reset-password
- 데모 버전: SMTP 미연결, 응답에 _demo_token 포함
- 미등록 이메일도 동일 응답 (이메일 존재 여부 노출 방지)
- 로그인 → 비밀번호 찾기 → 이메일 입력 → 토큰 → 비밀번호 재설정

### 버그 수정
- 로그인 버튼 동작 안 함: auth-gate 닫기 시 navigateTo('/') 덮어쓰기 방지
- /reset-password?token=... 쿼리스트링 때문에 라우트 매칭 실패 수정

---

## v0.13 — 2026-04-13
**어드민 대시보드 구현**
- /admin 경로에 별도 어드민 SPA 추가 (role 기반 접근 제어)
- 대시보드: PV/UV/DAU/MAU 통계, 활동 그래프, Safety 위반 추이 차트
- 캐릭터 평가: 9개 항목 가중 점수, recommendedPersona 적용, 대화 미리보기
- 유저 관리: 상세 조회, role 변경, 강제 탈퇴
- 캐릭터 관리: config.json/system.md 직접 편집, 활성화/비활성화
- 모더레이션: Safety 위반 로그 조회, 전체 대화 버블 UI
- 공통: 컬럼 정렬, 페이지네이션, 점수 매트릭스 최고/최저 강조
- page_views 테이블 추가, PV 로깅 미들웨어 (API/정적파일 제외)
- moderation_logs/eval_results 테이블 추가
- users.public_id (UUID v4) 도입

---

## v0.12 — 2026-04-13
**OG image URL 도메인 수정 (folio-charc.up.railway.app)**
- OG image URL 도메인 수정 (folio-charc.up.railway.app)

---

## v0.11 — 2026-04-13
**성인 콘텐츠 등급 시스템 및 캐릭터 설정 업데이트**
- users 테이블에 `adult_content_enabled` / `adult_verified` 컬럼 추가
- 성인 최초 인증 API (POST /adult-verify) 및 ON/OFF 토글 API (PATCH /adult-content) 추가
- 캐릭터 목록 조회 시 유저의 성인 인증 여부에 따라 `adult_only` 캐릭터 필터링
- 캐릭터 config.json 파일 업데이트 (rating 필드 정비)
- README 업데이트: 배포 URL, 지원 모델 목록, 기능 목록, 기술 스택

---

## v0.10 — 2026-04-13
**UI 컴포넌트화 및 페르소나 플로우 버그 수정**
- `.content-header` / `.content-header-title` / `.content-header-desc` 컴포넌트 추가 — 인라인 스타일로 중복 작성되던 섹션 제목·서브텍스트 패턴 통일
- 빌더 홈 화면에 `.tab-header-with-subtitle` 적용 — 서브텍스트가 탭 제목과 시각적으로 묶이도록 구조 개선
- `.select-card-icon` 크기 44×44 → 40×40px 조정 (이모지·SVG 비율 개선)
- 마이페이지 → 새 페르소나 플로우 진입 시 이전 캐릭터 정보가 subtitle·placeholder에 잔존하던 버그 수정
- `syncUserPlaceholders()` standalone 모드 가드 추가 및 하드코딩 예시 텍스트 제거

---

## v0.9 — 2026-04-13
**탐색 페이지, 마이페이지 탭 리디자인, 책갈피·페르소나 상세 기능 추가**
- /explore 탐색 페이지: 텍스트 검색 + AND 태그 필터 (초성 검색 지원)
- 마이페이지 언더라인 탭 구조 (내 페르소나 / 내 캐릭터 / 책갈피)
- 책갈피 기능: bookmarks DB 테이블, API, 캐릭터 프로필 북마크 토글
- 페르소나 상세 페이지 (/persona/:id): 외형·성격·특이사항 프로필 뷰
- 캐릭터 태그 시스템, 공지 캐러셀, 준비중 카드, 빌더 모델 선택
- 히스토리 삭제 UI 개선, 메인 검색 제거 (탐색 페이지로 통합)
- prompts/ 구조 리팩토링: safety on/off 분리, 모델별 보정 파일

---

## v0.8 — 2026-04-12
**로그인·마이페이지 시스템 구현 및 UI 개선**

### 주요 기능
- **회원 인증 시스템 도입**
  - 이메일/비밀번호 기반 회원가입·로그인·로그아웃·회원 탈퇴
  - bcryptjs 비밀번호 해싱, express-session + SQLite 세션 스토어로 서버 재시작 후에도 로그인 유지
  - 인증 필요 화면(/history, /mypage, /builder)에 로그인 유도 모달 적용
- **마이페이지 신설**
  - 프로필 사진 업로드 및 변경
  - 닉네임·이메일·비밀번호 수정
  - 내 페르소나 목록 관리 (추가·삭제·기본값 설정)
  - 내 캐릭터 목록 관리 (프로필 이동·수정·삭제)
- **데이터베이스 확장**
  - users, personas, auth_sessions 테이블 신규 추가
  - 기존 sessions 테이블에 user_id 외래키 컬럼 추가 (회원/비회원 세션 분리)

### 버그 수정
- 캐릭터 수정 시 외형·성격·말투 등 필드가 초기화되던 문제 수정 (`_builderData` 저장 방식 도입)
- 채팅 입력창 멀티라인 시 전송 버튼이 세로로 늘어나던 UI 버그 수정
- 추천 페르소나 채우기 시 성별이 채워지지 않던 버그 수정 (selectGender 토글 로직 우회)
- 뒤로가기 동작 정상화 (`goBack()` 함수로 History API 기반 처리)

---

## v0.7 — 2026-04-12
**신규 캐릭터 2종 추가 및 빌더 개선**

### 주요 기능
- **박재헌, 지세현 캐릭터 추가**
  - config.json(메타 정보, 추천 페르소나) + system.md(롤플레이 프롬프트) 각각 작성
  - 프로필 이미지 등록
- **캐릭터 프로필에 세계관 아코디언 섹션 추가**
  - config.json에 worldbuilding 필드 있을 때만 표시
  - 펼침/접힘 토글 UI
- **추천 페르소나 자동 채우기 개선**
  - 캐릭터별 recommendedPersona에 성별 필드 추가
  - 채우기 버튼 클릭 시 성별 포함 전체 필드 자동 입력
- **빌더(AI 어시스턴트) 개선**
  - 캐릭터 완성 시 안내 메시지 출력 후 생성 데이터 전송하도록 수정
  - 생성 시 '유저' 표현 → `{{user}}` 토큰으로 자동 치환

### 버그 수정
- 캐릭터 등록 시 PayloadTooLargeError 수정 (express.json limit 10mb 상향)

---

## v0.6 — 2026-04-11
**스플래시 스크린, 메시지 재생성 페이지네이션, UI 개선**

### 주요 기능
- **스플래시 스크린 추가**
  - 앱 최초 진입 시 Folio 로고 fade in/out 애니메이션 표시
- **메시지 재생성 페이지네이션**
  - 재생성 시 이전/다음 버전 전환 버튼으로 응답 비교 가능
- **UI 개선**
  - 검색·메뉴 버튼 SVG 아이콘으로 교체
  - 하단 내비게이션 위치 이동 (데스크탑 레이아웃 높이 불일치 수정)
  - 모델 피커 팝업 위치 조정

### 버그 수정
- regenerate 엔드포인트 max_tokens 1024 → 8192로 수정 (응답 중간 잘림 방지)

---

## v0.5 — 2026-04-11
**대화 히스토리 UI 개편 및 Gemini 지원·캐릭터 빌더 추가**

### 주요 기능
- **대화 히스토리 화면 개편**
  - /history 라우트 연결
  - 세션 카드에 캐릭터 아바타·이름·페르소나 태그·Safety 등급 배지 표시
  - 복수 선택 삭제 기능 추가
- **하단 내비게이션 '대화' 탭 추가**
- **페르소나 설정에 성별 선택 버튼 추가**
- **채팅 헤더 클릭 시 캐릭터 프로필 팝업** (슬라이드 업/다운 애니메이션)
- **Gemini 모델 지원 추가**
  - gemini-2.5-flash, gemini-2.5-pro (@google/genai v1.49)
  - lib/gemini.js 분리, chat·regenerate 라우트에 분기 처리
- **캐릭터 빌더(AI 어시스턴트) 추가**
  - /builder 화면에서 Claude와 대화하며 캐릭터 제작
  - 완성된 캐릭터 데이터로 system.md 자동 생성·등록

### 버그 수정
- sessions API character_id·safety 필드 누락 수정
- openBuilder 무한 콜스택 오류 수정
- 체크박스 ::after CSS 미지원 문제 수정
- disabled 버튼 클릭 불가 문제 수정

---

## v0.4 — 2026-04-10
**멀티 캐릭터 지원 및 랜딩 화면 전면 개편**

### 주요 기능
- **멀티 캐릭터 아키텍처 도입**
  - prompts/ 구조를 common/ + characters/{id}/ 로 재편
  - GET /api/characters 엔드포인트로 캐릭터 목록 동적 로딩
  - buildSystemPrompt에 characterId 파라미터 추가
  - sessions 테이블에 character_id 컬럼 추가
- **캐릭터 2종 운영**
  - 이화(ihwa): 연애 감성 캐릭터
  - 유진(yoojin): 해커 컨셉 캐릭터
- **랜딩 화면 전면 개편**
  - 2열 이미지 카드 그리드 (3:4 비율, 그라디언트 오버레이)
  - 비활성 캐릭터 'Coming Soon' 오버레이
- **앱 브랜딩 작업**
  - Folio 로고 타이포 적용
  - 파비콘, OG 메타 태그 설정

---

## v0.3 — 2026-04-10
**AI 모델 선택 기능 및 채팅 헤더 개선**

### 주요 기능
- **모델 선택 피커 추가**
  - Claude Sonnet 4.6 / Opus 4.6 / Haiku 4.5 선택 가능
  - 선택 모델을 세션 DB에 저장, 재생성 시에도 동일 모델 사용
  - 팝오버 형태 UI (position:fixed로 overflow 클리핑 방지)
- **채팅 헤더 개선**
  - 텍스트 아바타 → 캐릭터 프로필 이미지 원형 표시

---

## v0.2 — 2026-04-09
**전체 기능 빌드 — DB 영속성, UI 전면 재설계, 채팅 기능 확장**

### 주요 기능
- **SQLite 영속성 도입 (better-sqlite3)**
  - sessions, messages 테이블 (WAL 모드, 외래키 활성화)
  - 세션별 유저 노트 저장 (GET/PUT /api/notes)
  - 대화 히스토리 목록·상세 조회 (GET /api/sessions)
- **메시지 재생성 기능 추가** (DELETE last + 재호출)
- **시스템 프롬프트 고도화**
  - 페르소나 블록·유저 노트 블록 동적 주입
  - 이화 캐릭터 감정 지원 행동 규칙 상세화
- **UI 전면 재설계 (모바일 퍼스트 다크 테마)**
  - 5개 화면 SPA: 랜딩 → 캐릭터 소개 → 페르소나 설정 → 채팅 → 히스토리
  - 색상 체계: --bg #0A0E17, --surface #131927, --accent #5B8FB9
  - 채팅 입력창 자동 높이 조절, 타이핑 인디케이터 애니메이션

---

## v0.1 — 2026-04-09
**MVP 프로토타입**

### 주요 기능
- Node.js + Express 5 기반 서버 구성
- Claude API(claude-sonnet-4-6) 연동 단일 캐릭터 채팅
- 기본 시스템 프롬프트 및 페르소나 입력 UI
- 정적 프론트엔드 (HTML/CSS/JS 단일 페이지)

---

*이 로그는 Git 커밋 이력을 기반으로 작성되었습니다.*
