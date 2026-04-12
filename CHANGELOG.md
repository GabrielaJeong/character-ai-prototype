<!-- changelog-last-commit: df291ac25945a93c8656611c263012ff311b097f -->
<!-- changelog-last-version: 0.11 -->



# Folio — 업데이트 로그

> AI 캐릭터 채팅 플랫폼 프로토타입  
> 기록 기준: Git 커밋 이력

---

## v0.11 — 2026-04-13
**adult content system, character config updates, README refresh**
- db: add adult_content_enabled / adult_verified columns + prepared stmts
- auth: POST /adult-verify and PATCH /adult-content endpoints
- characters: filter adult_only by user adult_content_enabled flag
- personas: minor route fixes
- prompts: update character config.json files
- README: update live URL, model list, feature list, tech stack

---

## v0.10 — 2026-04-13
**componentize UI — content-header, select-card, tab-header-with-subtitle**
- Add .content-header / .content-header-title / .content-header-desc component
- Add .tab-header-with-subtitle + .tab-header-title-row modifier for builder home
- Reduce .select-card-icon from 44×44 to 40×40px for better emoji/SVG proportion
- Fix _routePersonaNew(): reset persona-subtitle and p-notes placeholder to
- Fix syncUserPlaceholders(): guard with _personaMode === 'standalone' and

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
