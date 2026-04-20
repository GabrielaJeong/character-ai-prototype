# CURRENT_STATE.md

> Folio 현재 상태 스냅샷. 다음 세션 시작 시 빠른 파악용.
> 최종 업데이트: 2026-04-21 (v0.22)

---

## 구현 완료 기능

### 유저 기능
- [x] 4명 프리빌트 캐릭터 대화 (이화, 영일, 지세현, 박재헌)
- [x] 멀티 모델 (Claude 3종 + Gemini 3종, 기본 Gemini 3.1 Pro)
- [x] 소설/채팅 모드, 응답 재생성 + 페이지네이션
- [x] 캐릭터 빌더 (AI 대화형 + 직접 제작)
- [x] 유저 페르소나 시스템
- [x] 콘텐츠 등급 시스템 (all / toggleable / adult_only)
- [x] 책갈피, 좋아요 (UI만, API 미연결)
- [x] 탐색 페이지 (큐레이션 + 랭킹)
- [x] 알림 시스템 (NOTICE / SOCIAL / SYSTEM)
- [x] 크리에이터 시스템 (@username, 프로필 페이지)
- [x] 비밀번호 찾기 (데모)

### 어드민 기능
- [x] 대시보드 (PV/UV/DAU/MAU)
- [x] 캐릭터성 평가 (LLM Self-Eval)
- [x] 유저/캐릭터/모더레이션 관리
- [x] 큐레이션 관리 (드래그앤드롭)
- [x] 알림 등록 관리

---

## 인프라 / 하네스

- [x] CHANGELOG.md 운영
- [x] CLAUDE.md (클로드 코드 진입점)
- [x] docs/CONVENTIONS.md (코딩 규칙)
- [x] docs/DECISIONS.md (설계 결정, 10건)
- [x] docs/LESSONS.md (실수 패턴, 6건)
- [x] docs/SESSION_CHECKLIST.md
- [x] ESLint + Prettier + .editorconfig
- [x] Jest + supertest (41개 테스트 통과)
- [x] GitHub Actions CI

---

## 미구현 / 로드맵

### Phase 2 (가설 검증 예정)
- [ ] AI 빌더 A/B 테스트 (가설 4)
- [ ] LLM Self-Eval 자동화 회귀 테스트 (가설 5)
- [ ] 콘텐츠 등급 시스템 유저 설정 변경 빈도 측정 (가설 6)

### Phase 3 (설계 단계)
- [ ] 모델 라우팅 자동화 (가설 7)
- [ ] 크리에이터 팔로우 시스템 (가설 8 확장)

### 기능 미구현
- [ ] 좋아요 기능 API 연동 (현재 UI만)
- [ ] 댓글 시스템 (UI placeholder만)
- [ ] 토큰 결제 시스템 (UI placeholder만)
- [ ] 소셜 로그인 (Google, Kakao)
- [ ] 장기 기억 (대화 요약 저장형)

### 하네스 확장
- [ ] Sentry 에러 로깅 (프로덕션 단계)
- [ ] 테스트 커버리지 50% 달성 (현재 34.79%)
- [ ] 어드민 서브도메인 분리 (프로덕션)

---

## 테스트 커버리지 현황 (v0.22 기준)

**전체**: Statements 34.79% / Lines 36.44%

### 잘 커버된 파일
- buildSystemPrompt.js: 100%
- db/index.js: 82.6%
- routes/sessions.js: 80.76%

### 취약한 파일 (후순위 테스트 대상)
- routes/admin.js: 13.54%
- routes/chat.js: 24.59% (LLM 모킹 필요)
- routes/regenerate.js: 27.27% (LLM 모킹 필요)

---

## 최근 발견된 버그 패턴

자세한 내용은 docs/LESSONS.md 참조.

- L-001: API 응답 필드 누락 (v0.22에서 sessions.js detail 재발)
- L-002: Config ↔ Source drift (ihwa notes)
- L-003: Static HTML + JS renderer 충돌
- L-004: 프롬프트 노하우 공개 위험
- L-005: 역할 체크 단일 필드 의존
- L-006: 버전 번호 중복 기록

---

## 배포 상태

- Railway 자동 배포 중 (GitHub push 시)
- 커스텀 도메인 적용
- GitHub Actions CI 통과 시에만 반영 (설정 예정)
