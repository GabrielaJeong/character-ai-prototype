# Folio — Character AI Platform Prototype

프롬프트 설계로 모델 편향을 보정하고, 대화형 빌더로 캐릭터 제작의 진입장벽을 낮추다

> PM 기획 + 프롬프트 설계 + 개발 + UI/UX | 정소채 (Gabriela)

## 배포

🔗 [Live Demo](https://folio-charc.up.railway.app/)

## 프로젝트 요약

캐릭터 AI 챗봇 플랫폼 프로토타입. 동일한 프롬프트를 적용해도 모델마다 캐릭터성 유지율이 달라지는 문제를 발견하고, 5개 모델 × 4캐릭터 비교 실험을 통해 모델별 프롬프트 보정 전략과 비용 최적화 모델 라우팅을 설계했다.

## 핵심 가설 & 검증 결과

| 가설 | 결과 |
|------|------|
| 구체적 행동 규칙으로 프롬프트를 설계하면 캐릭터성을 유지할 수 있다 | ✅ Claude Opus 100% / Gemini 3.1 Pro 95% / Gemini 2.5 Flash 42% |
| AI 대화형 빌더로 비전문가도 고품질 캐릭터를 만들 수 있다 | ✅ 구현 완료, 유저 테스트 예정 |

## 주요 기능

- **멀티 모델 대화** — Claude 3종 (Sonnet/Opus/Haiku) + Gemini 3종 (2.5 Flash/2.5 Pro/3.1 Pro)
- **소설/채팅 모드** — 소설체 ↔ 채팅 표시 전환
- **캐릭터 빌더** — AI 에이전트와 대화하며 캐릭터 제작 (모델 선택 가능)
- **유저 페르소나** — 추천 프리셋 + 직접 입력, {{user}} 치환, 기본 페르소나 지정
- **콘텐츠 등급 토글** — 전연령/성인 세그먼트 컨트롤, 3단계 Safety 방어 정책
- **탐색 페이지** — 캐릭터 검색 (초성 지원) + 태그 필터링
- **이전 대화 관리** — SQLite 영구 저장, 이어하기, 선택 삭제
- **응답 재생성** — 페이지네이션 (← 1/2 → 버전 전환)
- **유저 노트** — system prompt 자동 삽입
- **회원 시스템** — 이메일/비밀번호 로그인, Joi 밸리데이션, 서버 세션
- **마이페이지** — 내 페르소나 / 내 캐릭터 / 책갈피 (언더라인 탭)
- **책갈피** — 캐릭터 즐겨찾기
- **모델별 프롬프트 보정** — models/ 폴더에 모델별 보정 규칙 분리

## 기술 스택

| 계층 | 기술 |
|------|------|
| Backend | Node.js, Express |
| AI | Anthropic API (Claude), Google AI SDK (Gemini) |
| DB | SQLite (better-sqlite3) |
| Auth | bcryptjs, express-session, Joi |
| Frontend | HTML/CSS/JS (모바일 앱 스타일 430px) |
| Routing | History API (클라이언트 사이드) |
| Deploy | Railway (GitHub push 자동 배포) |

## 프로젝트 구조

```
prompts/
├── common/
│   ├── guardrails.md             # 공통 가드레일 (OOC, 클리셰 금지, 응답 길이)
│   └── safety/
│       ├── on.md                 # Safety ON 규칙 + 3단계 방어
│       └── off.md                # Safety OFF 규칙
├── models/                       # 모델별 프롬프트 보정
│   ├── claude-sonnet-4-6.md
│   ├── claude-opus-4-6.md
│   ├── gemini-3.1-pro-preview.md
│   └── ...
├── characters/{id}/
│   ├── config.json               # 캐릭터 메타 (태그, 추천 페르소나, 세계관)
│   └── system.md                 # 캐릭터 롤플레이 프롬프트
├── builder/agent.md              # 빌더 에이전트
└── buildSystemPrompt.js          # 조합: char + guardrails + model + safety + persona + note

routes/
├── chat.js                       # 대화 (멀티 모델, 세션 관리)
├── regenerate.js                 # 응답 재생성
├── sessions.js                   # 세션 목록 조회, 삭제
├── notes.js                      # 유저 노트 CRUD
├── characters.js                 # 캐릭터 목록, 등록, 조회, 삭제
├── builder.js                    # 빌더 에이전트 대화, 프롬프트 생성
├── auth.js                       # 회원가입, 로그인, 로그아웃, 정보 수정, 탈퇴
├── personas.js                   # 페르소나 CRUD + 기본 설정
└── bookmarks.js                  # 캐릭터 즐겨찾기
```

## 캐릭터

| | 이화 | 영일 (유진) | 지세현 | 박재헌 |
|---|---|---|---|---|
| 직업 | 프로파일러 | 해커 | 방송 작가 | 서점 사장 (전 던전요원) |
| 문체 | 서정적 소설체 | 감정폭발 소설체 | 건조 담백 소설체 | 무거운 서정 소설체 |
| 세계관 | 현실 | 현실 | 현실 | 초자연 (던전/능력) |
| Safety | ON/OFF | OFF 고정 | ON/OFF | ON/OFF |

## 프롬프트 설계 전략

- 추상적 성격 묘사 대신 **구체적 행동 규칙 + 상황별 전환 조건**
- **3층 프롬프트 구조**: 캐릭터(system.md) + 공통(guardrails.md) + 모델별 보정(models/)
- MODEL-AGNOSTIC CRITICAL RULES: 시점 일관성, 유저 설정값 강제, 금지 표현, 응답 길이
- Safety ON 3단계 방어: IC 거부 → OOC 안내 → Hard stop
- OOC 처리 3분류: 정상 지시(허용) / Safety 우회(차단) / 애매한 케이스(현재 등급 기준)

## 모델 비교 실험

5개 모델 × 4캐릭터, 9개 평가 항목으로 캐릭터성 유지율 비교

| 순위 | 모델 | 평균 유지율 | 비용 (Output $/1M) |
|------|------|-----------|-------------------|
| 1 | Claude Opus 4.6 | **100%** | $25.00 |
| 2 | Gemini 3.1 Pro | **95%** | $12.00 |
| 3 | Claude Sonnet 4.6 | 81% | $15.00 |
| 4 | Gemini 2.5 Pro | 50% | $10.00 |
| 5 | Gemini 2.5 Flash | 42% | $10.00 |

기본 모델: Gemini 3.1 Pro (비용 대비 최고 성능, Opus 대비 Output 52% 절감)

## 문서

- [PRD v5](노션 링크)
- [모델 비교 리포트](노션 링크)
- [기능 회고 (Bug Retrospective)](노션 링크)
- [업데이트 로그](노션 링크)