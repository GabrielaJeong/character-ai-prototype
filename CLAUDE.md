# CLAUDE.md

> Folio 프로젝트의 Claude Code 작업용 컨텍스트 파일.
> 세션 시작 시 자동 로드되어 고정 맥락을 제공한다.

## 프로젝트 개요

**Folio** — 프롬프트 설계로 모델 편향을 보정하고, 대화형 빌더로 캐릭터 제작을 민주화하는 캐릭터 AI 플랫폼 (포트폴리오 프로토타입).

- **기술 스택**: Node.js + Express 5, SQLite (better-sqlite3), Anthropic API, Google AI SDK, Railway 배포
- **배포**: Railway (커스텀 도메인, GitHub push 자동 배포)
- **현재 버전**: `CHANGELOG.md` 최상단 참고

## 세션 시작 시 필수 확인 사항

**세션 시작할 때마다 아래 파일을 반드시 순서대로 확인할 것:**

1. **`CHANGELOG.md`** — 최신 버전과 최근 작업 내역
2. **`docs/CURRENT_STATE.md`** — 현재 구현/미구현 스냅샷
3. **`docs/LESSONS.md`** — 과거 실수 패턴과 재발 방지 규칙
4. **`docs/CONVENTIONS.md`** — 코딩 규칙
5. **`docs/DECISIONS.md`** — 주요 기술/설계 결정사항
6. **`docs/DESIGN_SYSTEM.md`** — UI 작업 시 토큰·컴포넌트 참조
7. 작업 범위와 관련된 파일들

## 프로젝트 구조

```
character-ai-prototype/
├── CLAUDE.md                        # 이 파일
├── CHANGELOG.md                     # 버전 이력
├── README.md                        # 프로젝트 소개
├── server.js                        # Express 5 진입점
├── package.json
├── .env / .env.example
├── .editorconfig
├── .eslintrc / .prettierrc
│
├── docs/
│   ├── DECISIONS.md                 # 주요 설계 결정
│   ├── LESSONS.md                   # 실수 패턴 + 재발 방지
│   ├── CONVENTIONS.md               # 코딩 규칙 상세
│   ├── DESIGN_SYSTEM.md             # 디자인 시스템 (토큰·컴포넌트·인터랙션)
│   ├── SECURITY.md                  # 보안 정책 및 방어 기법
│   ├── SESSION_CHECKLIST.md         # 세션 시작/종료 체크리스트
│   └── CURRENT_STATE.md             # 프로젝트 현재 상태 스냅샷
│
├── db/
│   ├── index.js                     # SQLite 스키마, prepared statements
│   └── chat.db                      # 실 데이터 (수정 금지)
│
├── routes/
│   ├── auth.js                      # 회원/로그인/비밀번호 찾기
│   ├── chat.js                      # 대화 스트리밍
│   ├── regenerate.js                # 응답 재생성
│   ├── sessions.js                  # 세션 관리
│   ├── characters.js                # 캐릭터 CRUD
│   ├── builder.js                   # AI 빌더 에이전트
│   ├── personas.js                  # 페르소나 CRUD
│   ├── bookmarks.js                 # 책갈피
│   ├── notifications.js             # 알림
│   ├── creator.js                   # 크리에이터 프로필
│   ├── notes.js                     # 캐릭터 노트
│   └── admin.js                     # 어드민 API
│
├── lib/
│   ├── gemini.js                    # Gemini API 클라이언트
│   ├── sessionOwnership.js          # 세션 소유권 검증 헬퍼
│   ├── memory.js                    # 캐릭터 장기기억 생성
│   └── releaseNotify.js             # 릴리즈 자동 알림 (CHANGELOG → AI → DB)
│
├── prompts/
│   ├── buildSystemPrompt.js         # 3층 프롬프트 조립
│   ├── common/
│   │   ├── guardrails.md            # MODEL-AGNOSTIC 공통 규칙
│   │   └── safety/ (on.md / off.md)
│   ├── models/                      # 모델별 보정 (Layer 3)
│   ├── builder/
│   │   └── agent.md
│   └── characters/                  # 캐릭터별 프롬프트 (Layer 1)
│       ├── yoojin/  (config.json + system.md)
│       ├── jaeheon/
│       ├── sehyun/
│       └── ihwa/
│
├── data/                            # JSON 런타임 데이터
│   ├── curation.json                # 홈/탐색 큐레이션
│   ├── broadcast-history.json
│   └── collection-history.json
│
├── public/                          # 프론트엔드 SPA
│   ├── index.html                   # 모든 screen 포함
│   ├── admin.html
│   ├── css/ (style.css / admin.css)
│   ├── js/ (app.js / admin.js)
│   ├── icons/                       # SVG 아이콘
│   ├── images/                      # 캐릭터·배너
│   └── uploads/                     # 유저 업로드
│
└── scripts/
    └── update-changelog.js
```

## 핵심 아키텍처

### 3층 프롬프트 아키텍처

`buildSystemPrompt.js`가 런타임에 조합:

1. **Layer 1** — `characters/{id}/system.md` (캐릭터 설정)
2. **Layer 2** — `common/guardrails.md` + `safety/on|off.md` (공통 규칙)
3. **Layer 3** — `models/{model_id}.md` (모델별 보정)

**변경 영향 범위:**
- 새 캐릭터 추가 → `characters/` 폴더에만
- 새 모델 추가 → `models/` 폴더에만
- 공통 규칙 변경 → `guardrails.md` 1개 파일만

### 콘텐츠 등급 시스템

`config.json`의 `rating` 필드:
- `all` — 전연령 전용, Safety 토글 없음
- `toggleable` — 전환 가능
- `adult_only` — 성인 고정 (영일 등)

### 기본 모델

**Gemini 3.1 Pro** (v0.17~). Opus 대비 Output 52% 절감, 유지율 95%.

### 크리에이터 시스템

- `users.username` (unique, 변경 불가), `public_id` (UUID v4, URL 노출용)
- 프리빌트 캐릭터는 `@midnight_atelier` 등 고정 크리에이터
- 유저 빌더 제작 캐릭터는 `owner_username`으로 연결
- `/creator/@:username` 프로필 페이지

### 캐릭터 설정 (config.json) 필드

```json
{
  "name": "이화",
  "nameEn": "Lee Hwa",
  "rating": "toggleable",
  "badge_override": null,
  "tags": ["#로맨스", "#연인", "#감성"],
  "about": {
    "world": "noir",
    "avg_length": "18min",
    "tone": "분석적 · 차가운 듯 다정한",
    "traits": ["분석적", "차가운 듯 다정한"],
    "opening_line": "..."
  },
  "notes": {
    "creator_note": "...",
    "rules": ["관찰 가능한 특성 문자열", "..."],
    "tip": "...",
    "notes_by": "@creator_username",
    "notes_date": "YYYY.MM.DD"
  }
}
```

## 코딩 규칙

**상세 규칙은 `docs/CONVENTIONS.md` 참조.**

### 핵심 원칙 (요약)
- Node.js: CommonJS만 사용 (ESM 금지)
- 모든 SQL은 `stmt` 객체의 prepared statement로만 (라우터에서 `db.prepare()` 직접 호출 금지)
- API 응답 시 `{ error: '한국어 메시지' }` 형식
- 인증 가드: 인증 필요 라우트 첫 줄에 `if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });`
- 프론트엔드 함수 네이밍: `loadXxx` / `populateXxx` / `updateXxx`
- 디자인 토큰만 사용 (monospace 계열 금지, `var(--font)`, `var(--accent)` 등)
- 역할 체크는 `role === 'admin'` 기준 (username 단일 체크 금지)

### 보안 (간략)
- `public_id` (UUID v4)로 내부 ID 미노출
- 비밀번호는 반드시 bcryptjs 해싱
- 입력 밸리데이션: Joi, 외부 경계에서만

## 반박·수정 정책

**유저가 제시한 코드/계획에 문제가 있으면 반드시 반박 후 수정안을 제시하고 진행한다.**

반박이 필요한 경우:
- 제시된 코드가 버그·보안 이슈·레이아웃 파괴를 일으킬 수 있을 때
- 더 나은 패턴이 존재할 때 (성능, 가독성, 유지보수)
- CLAUDE.md의 절대 금지 사항 또는 Red Flags에 걸릴 때

반박 형식: "반박: [이유]. [수정안] 으로 진행합니다."
반박 없이 그냥 실행하는 것은 금지. 문제가 없으면 그냥 진행.

## 절대 금지 사항

1. **이용 정책 위반 콘텐츠 생성** — Safety 시스템 우회 시도 금지
2. **실제 사용자 개인정보 하드코딩** — 테스트 데이터도 가명 사용
3. **하드코딩된 fallback 값** — 디버깅 어려움, 에러 로깅으로 대체
4. **`disabled` 속성만으로 버튼 비활성화** — 클릭 이벤트 차단됨, CSS 클래스 사용
5. **API 응답에서 DB 컬럼 누락** — list/detail/SQL 3곳 동시 검토 필수
6. **프롬프트 엔지니어링 노하우 전체 공개** — `notes.rules`에는 관찰 가능한 특성만
7. **username 변경** — DB 레벨에서 unique + immutable
8. **프로덕션 DB 파일 수정** — `db/chat.db` 직접 편집 금지 (마이그레이션 스크립트 사용)
9. **config.json과 system.md 독립 작성** — notes 내용은 system.md 기반으로만

## Red Flags — 이 패턴 작성 시 멈추고 확인

1. 🚩 `res.json({...})` 응답 객체 작성 중
   → DB 컬럼과 1:1 매핑했는가? list/detail/SQL 3곳 동기화?

2. 🚩 `btn.disabled = true` 사용
   → 클릭 이벤트 필요하면 CSS 클래스로 대체

3. 🚩 새 API 엔드포인트에 `max_tokens` 하드코딩
   → chat.js와 동일한 값인가? 파라미터화 가능한가?

4. 🚩 단일 필드로 역할 체크 (`username === 'admin'`)
   → `role === 'admin'` 기반인가?

5. 🚩 HTML에 정적 요소 + JS `innerHTML` 전체 교체
   → 정적 요소가 JS 렌더 영역 안에 들어가면 지워짐. JS 내부에서 삽입할 것.

6. 🚩 `notes.rules` 항목에 프롬프트 구조 언급
   → 관찰 가능한 캐릭터 특성만 허용 (프롬프트 노하우 공개 금지)

7. 🚩 `express-rate-limit` 추가 또는 수정 중
   → `app.set('trust proxy', 1)` 설정 여부 확인 (Railway 등 프록시 환경에서 미설정 시 전체 유저 IP 공유 → 한도 즉시 소진, L-008)

8. 🚩 helmet CSP `directives` 커스텀 설정 중
   → `scriptSrcAttr` 명시 여부 확인. helmet 기본값 `'none'`이 병합되어 `onclick="..."` 속성 핸들러 전부 차단됨. `scriptSrcAttr: ["'unsafe-inline'"]` 필수 (L-009)

9. 🚩 새 버튼 또는 클릭 가능한 요소 추가 중
   → **3종 체크**: `touch-action: manipulation` (div/span이면 직접 추가, button/a는 자동) / `min-height: 44px` / `:active` 피드백 (L-012)

10. 🚩 100vh 사용 중
    → `100dvh`로 변경. iOS Safari에서 100vh는 주소창 포함 전체 높이 → 레이아웃 overflow. fallback으로 100vh도 함께 선언.

11. 🚩 새 input/textarea 추가 중
    → `font-size: 16px` 이상 확인 (iOS 포커스 시 자동 줌인 방지). iOS 전용이면 `@supports (-webkit-touch-callout: none)` 사용.

## 자주 발생한 버그 패턴 (과거 학습)

| 패턴 | 해결 |
|------|------|
| API 응답 필드 누락 (character_id, safety 등) | list/detail/SQL 동시 검토 |
| 토큰/파라미터 불일치 (chat.js vs regenerate.js) | 모든 호출 경로에서 통일 |
| 환경별 명령어 차이 (pkill, Windows) | cross-platform 스크립트 |
| 서버 기본값 한도 초과 (body-parser) | 업로드 기능 추가 시 사전 확인 |
| disabled 버튼 클릭 불가 | CSS 클래스로 비활성 처리 |
| 순환 참조 (openBuilder 무한 콜스택) | 라우트 핸들러는 showScreen만 호출 |
| DOM 측정 타이밍 (autoResize) | 렌더링 후 requestAnimationFrame |
| Gemini thinking tokens 부족 | maxOutputTokens 8192+ |
| Config ↔ Source drift (notes vs system.md) | system.md 기반으로만 notes 작성 |
| Static HTML + JS renderer 충돌 | 정적 요소도 JS 내부에서 삽입 |

## 세션 종료 프로토콜

작업 완료 후 아래 순서대로 진행:

### 1. 버그 패턴 셀프 리포트
작업 중 발견한 실수/버그가 있었다면 다음을 판단:
- 반복 가능성이 있는 구조적 패턴인가?
- 해결책이 규칙화 가능한가?
- 위험도는? (낮음/중간/높음)

**→ 해당되면 `docs/LESSONS.md`에 L-XXX로 추가**
**→ 일회성이면 CHANGELOG의 버그 수정 섹션에만 기록**

### 2. 설계 결정사항 기록
작업 중 주요 설계 결정이 있었다면 `docs/DECISIONS.md`에 추가:
- 왜 이 방식을 선택했는가?
- 검토했던 대안은?
- 트레이드오프는?

### 3. CHANGELOG.md 업데이트
- 새 버전 번호 (v0.XX)
- 작업 내용 요약 (기능/수정/리팩토링)
- 변경된 주요 파일 목록

### 4. Git commit & push
- 커밋 메시지에 버전 번호 포함
- Railway 자동 배포 확인

## Git 브랜치 전략

- **작업 브랜치**: `dev` — 모든 커밋은 dev에.
- **main**: 릴리즈 전용. dev → main merge로만 업데이트.
- **직접 main 커밋 금지.**

```bash
# 현재 브랜치 확인
git branch

# dev로 전환 (잘못 main에 있을 경우)
git checkout dev
```

## 자주 쓰는 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 서버
npm start

# Windows 프로세스 종료 (pkill 대신)
netstat -ano | findstr :3000
Stop-Process -Id <PID>

# DB 마이그레이션 후 재시작 필수
```

## 디버깅 가이드

- 서버 재시작 안 됨 (Windows): `netstat -ano` → `Stop-Process`
- Gemini 429 오류: SDK 버전 확인 (`@google/genai` v1.49+)
- 프롬프트 변경 반영 안 됨: 서버 재시작 필요 (파일 캐시)
- 응답 중간 잘림: `max_tokens` 8192+ 확인
- 페이지 이동 후 좋아요/북마크 리셋: 클라이언트 상태 (API 연결 전 임시)

## 참고 문서

- `docs/CONVENTIONS.md` — 코딩 규칙 상세
- `docs/DESIGN_SYSTEM.md` — 컬러 토큰, 버튼, 카드, 모달, 인터랙션 규칙
- `docs/DECISIONS.md` — 주요 설계 결정사항
- `docs/LESSONS.md` — 실수 패턴 + 재발 방지 규칙
- `CHANGELOG.md` — 버전 이력