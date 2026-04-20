# Folio — Character AI Platform Prototype

프롬프트 설계로 모델 편향을 보정하고, 대화형 빌더로 캐릭터 제작의 진입장벽을 낮추다

> PM 기획 + 프롬프트 설계 + 개발 + UI/UX | 정소채 (Gabriela)

## 배포

🔗 [Live Demo](https://folio-charc.up.railway.app/)

## 프로젝트 요약

캐릭터 AI 챗봇 플랫폼 프로토타입. 동일한 프롬프트를 적용해도 모델마다 캐릭터성 유지율이 달라지는 문제를 발견하고, 5개 모델 × 4캐릭터 비교 실험을 통해 모델별 프롬프트 보정 전략과 비용 최적화 모델 라우팅을 설계했다. 3층 프롬프트 아키텍처(캐릭터 · 공통 · 모델별 보정)와 크리에이터 시스템, 테스트 하네스를 포함해 프로덕션급 개발 환경을 구축했다.

## 핵심 가설 & 검증 결과

| 가설 | 결과 |
|------|------|
| 구체적 행동 규칙으로 프롬프트를 설계하면 캐릭터성을 유지할 수 있다 | ✅ Opus 100% / Gemini 3.1 Pro 95% / Gemini 2.5 Flash 42% |
| 모델별 고유 편향 패턴을 식별하면 멀티 모델 품질을 유지할 수 있다 | ✅ 모델별 보정 레이어로 3층 아키텍처 검증 |
| 3층 프롬프트 구조로 변경 영향 범위를 최소화할 수 있다 | ✅ 새 캐릭터·새 모델 추가 시 격리된 폴더만 수정 |
| AI 대화형 빌더로 비전문가도 고품질 캐릭터를 만들 수 있다 | 🔜 구현 완료, 유저 테스트 예정 |
| @아이디 기반 크리에이터 시스템이 캐릭터 신뢰도를 높인다 | 🔜 구현 완료, 재방문율 측정 예정 |

## 주요 기능

### 유저 기능
- **멀티 모델 대화** — Claude 3종 (Sonnet/Opus/Haiku) + Gemini 3종 (2.5 Flash/2.5 Pro/3.1 Pro)
- **기본 모델**: Gemini 3.1 Pro (Opus 대비 Output 52% 절감, 유지율 95%)
- **소설/채팅 모드** — 소설체 ↔ 채팅 표시 전환
- **응답 재생성** — 페이지네이션 (← 1/2 → 버전 전환)
- **캐릭터 빌더** — AI 에이전트 대화형 + 직접 제작 폼 (양쪽 모두 지원)
- **유저 페르소나** — 추천 프리셋 + 직접 입력, {{user}} 치환, 기본 페르소나 지정
- **콘텐츠 등급 시스템** — 플랫폼 레벨 `rating` (all / toggleable / adult_only)
- **3단계 Safety 방어** — IC 거부 → OOC 안내 → Hard stop
- **크리에이터 시스템** — `/creator/@:username` 프로필, PINNED.WORK, 팔로우 (예정)
- **회원 시스템** — 이메일 + @아이디 + 닉네임 분리 가입, 이메일/@아이디 둘 다 로그인 가능
- **탐색 페이지** — 큐레이션 / 랭킹 탭 분리, 검색 (초성 지원) + 태그 필터
- **알림 시스템** — NOTICE / SOCIAL / SYSTEM 분류, 날짜 그룹
- **책갈피 + 좋아요** — 개인 컬렉션 vs 공개 반응 역할 분리
- **유저 노트** — system prompt 자동 삽입
- **이전 대화** — SQLite 영구 저장, 이어하기, 선택 삭제
- **마이페이지** — 내 페르소나 / 내 캐릭터 / 책갈피 탭, REVENUE.PREVIEW (BETA)

### 어드민 기능
- **대시보드** — PV/UV/DAU/MAU, 활동 통계 그래프, Safety 위반 추이
- **캐릭터성 평가** — LLM Self-Eval (Claude Opus 채점), 9항목 100점 매트릭스
- **유저 / 캐릭터 / 모더레이션 관리** — UUID public_id 기반
- **큐레이션 관리** — BROADCAST 캐러셀 · EDITOR.PICKS 드래그앤드롭, 이미지 업로드/히스토리
- **알림 관리** — NOTICE / SYSTEM 등록 폼

## 기술 스택

| 계층 | 기술 |
|------|------|
| Backend | Node.js, Express 5 |
| AI | Anthropic API (Claude), Google AI SDK (Gemini) |
| DB | SQLite (better-sqlite3) |
| Auth | bcryptjs, express-session, Joi |
| Frontend | HTML/CSS/JS (모바일 앱 스타일 430px, Pretendard 통일) |
| Routing | History API (클라이언트 사이드) |
| Test | Jest + supertest (41개 테스트) |
| CI | GitHub Actions (push/PR 자동 실행) |
| Deploy | Railway (GitHub push 자동 배포, 커스텀 도메인) |

## 3층 프롬프트 아키텍처

`buildSystemPrompt.js`가 런타임에 조합:

1. **Layer 1** — `characters/{id}/system.md` (캐릭터 설정)
2. **Layer 2** — `common/guardrails.md` + `safety/on|off.md` (공통 규칙)
3. **Layer 3** — `models/{model_id}.md` (모델별 보정)

### MODEL-AGNOSTIC CRITICAL RULES
- 시점 일관성 유지 (1인칭/3인칭)
- 유저 설정값(페르소나, 호칭, 시점) 강제 반영
- 금지 표현 블랙리스트 (몽글몽글, 눈 녹듯 등)
- 응답 길이 1000~2000자, 지문/내면/대사 구조 강제

### 변경 영향 범위
- 새 캐릭터 추가 → `characters/` 폴더에만
- 새 모델 추가 → `models/` 폴더에만
- 공통 규칙 변경 → `guardrails.md` 1개 파일만

## 프로젝트 구조

```
character-ai-prototype/
├── CLAUDE.md                     # 클로드 코드 작업용 컨텍스트
├── CHANGELOG.md                  # 버전 이력
├── README.md
├── server.js                     # Express 5 진입점
├── docs/                         # 내부 문서 (하네스 엔지니어링)
│   ├── CONVENTIONS.md            # 코딩 규칙
│   ├── DECISIONS.md              # 설계 결정사항 (D-001~)
│   ├── LESSONS.md                # 실수 패턴 + 재발 방지 (L-001~)
│   ├── SESSION_CHECKLIST.md      # 세션 시작/종료 체크리스트
│   └── CURRENT_STATE.md          # 현재 상태 스냅샷
├── prompts/
│   ├── common/
│   │   ├── guardrails.md
│   │   └── safety/ (on.md / off.md)
│   ├── models/                   # 모델별 보정 (Layer 3)
│   │   ├── claude-opus-4-6.md
│   │   ├── claude-sonnet-4-6.md
│   │   ├── gemini-3.1-pro-preview.md
│   │   └── ...
│   ├── characters/{id}/          # 캐릭터별 프롬프트 (Layer 1)
│   │   ├── config.json
│   │   └── system.md
│   ├── builder/agent.md
│   └── buildSystemPrompt.js
├── routes/
│   ├── auth.js                   # 회원가입/로그인/비밀번호 찾기
│   ├── chat.js                   # 대화 (멀티 모델, 세션 관리)
│   ├── regenerate.js             # 응답 재생성
│   ├── sessions.js               # 세션 목록 조회, 삭제
│   ├── characters.js             # 캐릭터 CRUD
│   ├── builder.js                # 빌더 에이전트
│   ├── personas.js               # 페르소나 CRUD
│   ├── bookmarks.js              # 책갈피
│   ├── notifications.js          # 알림
│   ├── creator.js                # 크리에이터 프로필
│   ├── notes.js                  # 유저 노트
│   └── admin.js                  # 어드민 API
├── tests/
│   ├── api/                      # API 응답 검증
│   └── unit/                     # 단위 테스트
├── lib/gemini.js
├── db/index.js
├── data/                         # 런타임 JSON (curation, history)
├── public/                       # SPA (index.html, admin.html)
└── .github/workflows/ci.yml      # GitHub Actions CI
```

## 캐릭터

| | 이화 | 영일 | 지세현 | 박재헌 |
|---|---|---|---|---|
| 직업 | 프로파일러 | 해커 | 방송 작가 | 서점 사장 |
| 문체 | 서정적 | 감정폭발 | 건조 담백 | 무거운 서정 |
| 세계관 | 현실 | 현실 | 현실 | 초자연 (던전/능력) |
| rating | toggleable | adult_only | toggleable | toggleable |

## 모델 비교 실험

5개 모델 × 4캐릭터, 9개 평가 항목으로 캐릭터성 유지율 비교

| 순위 | 모델 | 평균 유지율 | 비용 (Output $/1M) |
|------|------|-----------|-------------------|
| 1 | Claude Opus 4.6 | **100%** | $25.00 |
| 2 | **Gemini 3.1 Pro (기본)** | **95%** | **$12.00** |
| 3 | Claude Sonnet 4.6 | 81% | $15.00 |
| 4 | Gemini 2.5 Pro | 50% | $10.00 |
| 5 | Gemini 2.5 Flash | 42% | $10.00 |

**기본 모델**: Gemini 3.1 Pro (비용 대비 최고 성능)

## 개발 환경 / 하네스 엔지니어링

프로토타입이지만 실제 프로덕션 개발 환경을 시뮬레이션:

- **문서 체계화** — CLAUDE.md 진입점 + docs/ 5종 분리 관리
- **코드 품질** — ESLint + Prettier + .editorconfig 표준화
- **테스트** — Jest + supertest, 41개 테스트 (API 필드 누락 재발 방지 포함)
- **CI** — GitHub Actions 자동 실행 (push/PR)
- **버전 관리** — `[release]` 태그 기반 CHANGELOG 자동 갱신
- **학습 축적** — LESSONS.md (실수 패턴 6건) + DECISIONS.md (설계 결정 10건)

## 시작하기

```bash
git clone https://github.com/GabrielaJeong/character-ai-prototype.git
cd character-ai-prototype
npm install
```

### 환경 변수 (`.env`)

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
SESSION_SECRET=...
PORT=3000
```

### 실행

```bash
npm run dev          # 개발 모드
npm start            # 프로덕션
npm test             # 테스트 실행
npm run test:coverage  # 커버리지 리포트
```

## 문서

- **[CHANGELOG.md](./CHANGELOG.md)** — 버전 이력
- **[CLAUDE.md](./CLAUDE.md)** — 클로드 코드 작업용 컨텍스트
- **[docs/DECISIONS.md](./docs/DECISIONS.md)** — 주요 설계 결정사항
- **[docs/LESSONS.md](./docs/LESSONS.md)** — 실수 패턴 + 재발 방지
- **[docs/CONVENTIONS.md](./docs/CONVENTIONS.md)** — 코딩 규칙

### 외부 문서
- [PRD](노션 링크)
- [모델 비교 리포트](노션 링크)
- [기능 회고 (Bug Retrospective)](노션 링크)
- [업데이트 로그](노션 링크)

## 라이선스

이 프로젝트는 포트폴리오용 프로토타입입니다. 상업적 사용을 위한 라이선스는 별도 협의.