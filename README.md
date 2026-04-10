# Folio — Character AI Platform Prototype

프롬프트 설계로 모델 편향을 보정하고, 대화형 빌더로 캐릭터 제작의 진입장벽을 낮추다

> PM 기획 + 프롬프트 설계 + 개발 + UI/UX | 정소채 (Gabriela)

## 배포

🔗 [Live Demo](배포 URL)

## 프로젝트 요약

캐릭터 AI 챗봇 플랫폼 프로토타입. 동일한 프롬프트를 적용해도 모델마다 캐릭터성 유지율이 달라지는 문제를 발견하고, 모델 편향을 보정하는 프롬프트 설계 전략을 검증했다.

## 핵심 가설 & 검증 결과

| 가설 | 결과 |
|------|------|
| 구체적 행동 규칙으로 프롬프트를 설계하면 캐릭터성을 유지할 수 있다 | ✅ Claude 100% / ⚠️ Gemini 33% → MODEL-AGNOSTIC 규칙 강화로 보정 중 |
| AI 대화형 빌더로 비전문가도 고품질 캐릭터를 만들 수 있다 | ✅ 구현 완료, 유저 테스트 예정 |

## 주요 기능

- **멀티 모델 대화** — Claude 3종 (Sonnet/Opus/Haiku) + Gemini 2종 (Flash/Pro)
- **소설/채팅 모드** — 3인칭 소설체 ↔ 일반 채팅 전환
- **캐릭터 빌더** — AI 에이전트와 대화하며 캐릭터 제작
- **유저 페르소나** — 추천 프리셋 + 직접 입력, {{user}} 치환
- **콘텐츠 등급 토글** — 전연령/성인 전환, 3단계 Safety 방어 정책
- **이전 대화 관리** — SQLite 영구 저장, 이어하기, 선택 삭제
- **응답 재생성** / **유저 노트** (system prompt 자동 삽입)

## 기술 스택

| 계층 | 기술 |
|------|------|
| Backend | Node.js, Express |
| AI | Anthropic API (Claude), Google AI SDK (Gemini) |
| DB | SQLite |
| Frontend | HTML/CSS/JS (모바일 앱 스타일 430px) |
| Routing | History API (클라이언트 사이드) |
| Deploy | Railway (GitHub push 자동 배포) |

## 프로젝트 구조

```
prompts/
├── common/guardrails.md          # 공통 가드레일 (OOC, Safety, 클리셰 금지)
├── characters/{id}/system.md     # 캐릭터별 프롬프트
├── characters/{id}/config.json   # 캐릭터 설정
└── builder/agent.md              # 빌더 에이전트
routes/
├── chat.js                       # 대화 API
├── regenerate.js                 # 응답 재생성
├── sessions.js                   # 세션 관리
├── notes.js                      # 유저 노트
├── characters.js                 # 캐릭터 CRUD
└── builder.js                    # 빌더 에이전트
```

## 캐릭터

| | 이화 (李花) | 유진 (最有進) |
|---|---|---|
| 직업 | S.A. 프로파일러 | 해커/크래커 |
| 문체 | 서정적 소설체 | 감정폭발 소설체 |
| Safety | ON/OFF 가능 | OFF 고정 |

## 프롬프트 설계 전략

- 추상적 성격 묘사 대신 **구체적 행동 규칙 + 상황별 전환 조건**
- MODEL-AGNOSTIC CRITICAL RULES: 시점 일관성, 유저 설정값 강제, 금지 표현
- Safety ON 3단계 방어: IC 거부 → OOC 안내 → Hard stop
- OOC 처리 3분류: 정상 지시(허용) / Safety 우회(차단) / 애매한 케이스(현재 등급 기준)

## 모델 비교 실험

동일 프롬프트로 Claude vs Gemini 캐릭터성 유지율 비교 (9개 항목)

| | Claude Sonnet 4.6 | Gemini 2.5 |
|---|---|---|
| 캐릭터성 유지율 | **100%** (9/9) | **33%** (3/9) |

상세: [Model Comparison Report](docs/Model_Comparison_Report.docx)

## 문서

- [PRD v4](docs/Character_AI_Prototype_PRD_v4.docx)
- [프롬프트 테스트 리포트](docs/Prompt_Test_Report.docx)
- [모델 비교 리포트](docs/Model_Comparison_Report.docx)