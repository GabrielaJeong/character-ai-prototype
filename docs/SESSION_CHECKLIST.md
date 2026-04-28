# SESSION_CHECKLIST.md

> 클로드 코드 세션 시작/종료 시 사용하는 체크리스트.

---

## 🚀 세션 시작 시

### 1단계: 컨텍스트 로드
- [ ] CLAUDE.md 확인 (자동 로드되지만 변경사항 있나 체크)
- [ ] CHANGELOG.md 최상단 3개 버전 확인 (최근 작업 파악)
- [ ] docs/LESSONS.md — 위험도 '높음' 항목 재확인
- [ ] docs/DECISIONS.md — 이번 작업과 관련된 D-XXX 확인
- [ ] docs/CONVENTIONS.md — 작업할 영역의 규칙 확인
- [ ] docs/CURRENT_STATE.md — 현재 구현/미구현 현황 파악

### 2단계: 작업 범위 파악
- [ ] 수정할 파일 경로 확인
- [ ] 해당 파일과 연관된 route / DB / prompt 파악
- [ ] Red Flags 체크리스트 (CLAUDE.md, 11종) 숙지

### 3단계: 브랜치 & 테스트 환경 확인
- [ ] **현재 브랜치가 `dev`인지 확인** (`git branch`) — main 직접 커밋 금지
- [ ] `npm test` 실행 → 49개 테스트 모두 통과 확인
- [ ] 실패 시 원인 파악 후 시작

---

## 💻 작업 중

### 코딩 시
- [ ] CONVENTIONS.md 규칙 준수 (네이밍, SQL stmt, API 응답 형식)
- [ ] Red Flags 패턴 발견 시 즉시 확인
- [ ] DB 컬럼 추가/변경 시 list/detail/SQL 3곳 동시 검토
- [ ] 새 API 엔드포인트 추가 시 대응 테스트 작성

### 모바일 인터랙션 추가/수정 시 (L-012)
- [ ] `<button>`/`<a>` 외 요소에 onclick 시 `touch-action: manipulation` 직접 추가
- [ ] 터치 타겟 최소 44×44px (`min-height: 44px` + flex 정렬)
- [ ] `:hover`만 있으면 안 됨 → `:active` 피드백 추가
- [ ] iOS Safari 실기기 또는 Safari 원격 디버깅 검증

### 프롬프트 파일 수정 시
- [ ] system.md와 config.json의 notes 동기화 (L-002)
- [ ] 프롬프트 엔지니어링 노하우 공개 금지 (L-004)

### 보안 관련 변경 시
- [ ] helmet CSP 변경 시 `scriptSrcAttr` 명시 (L-009)
- [ ] rate-limit 추가/수정 시 trust proxy 확인 (L-008)
- [ ] UUID 기반 라우트에 `verifyOwnership` 적용 (L-010)

---

## ✅ 세션 종료 시

### 1단계: 버그 패턴 셀프 리포트
- [ ] 작업 중 발견한 실수/버그가 반복 가능성 있는가?
- [ ] 있다면 docs/LESSONS.md에 L-XXX로 추가
- [ ] 일회성이면 CHANGELOG 버그 수정 섹션에만 기록

### 2단계: 설계 결정사항
- [ ] 주요 설계 결정이 있었다면 docs/DECISIONS.md에 D-XXX 추가
- [ ] 근거, 대안, 트레이드오프 명시

### 3단계: 테스트 실행
- [ ] `npm test` → 전체 통과 확인
- [ ] 새 기능에 테스트 추가했는가?
- [ ] `npm run test:coverage` → 커버리지 리그레션 없는지 확인

### 4단계: Git 커밋 & 푸시 (`dev` 브랜치)
- [ ] `git status`로 현재 브랜치 `dev` 확인
- [ ] CHANGELOG는 자동 생성됨 (`[release]` 태그 커밋 시 훅이 처리)
  - 일반 작업: 일반 커밋 메시지
  - 릴리즈 시: 커밋 메시지에 `[release]` 포함 → CHANGELOG 자동 갱신
- [ ] `git push` (필요 시 두 번)
- [ ] GitHub Actions CI 통과 확인

### 5단계: main 머지 (릴리즈/배포 시점)
- [ ] `git checkout main && git merge dev --no-ff -m "merge: ..."`
- [ ] `git push`로 Railway 자동 배포 트리거
- [ ] `git checkout dev`로 복귀
- [ ] 배포 완료 후 사이트 동작 확인
