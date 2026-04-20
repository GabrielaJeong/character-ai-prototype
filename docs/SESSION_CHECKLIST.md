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

### 2단계: 작업 범위 파악
- [ ] 수정할 파일 경로 확인
- [ ] 해당 파일과 연관된 route / DB / prompt 파악
- [ ] Red Flags 체크리스트 (CLAUDE.md) 숙지

### 3단계: 테스트 환경 확인
- [ ] npm test 실행 → 41개 테스트 모두 통과 확인
- [ ] 실패 시 원인 파악 후 시작

---

## 💻 작업 중

### 코딩 시
- [ ] CONVENTIONS.md 규칙 준수 (네이밍, SQL stmt, API 응답 형식)
- [ ] Red Flags 패턴 발견 시 즉시 확인
- [ ] DB 컬럼 추가/변경 시 list/detail/SQL 3곳 동시 검토
- [ ] 새 API 엔드포인트 추가 시 대응 테스트 작성

### 프롬프트 파일 수정 시
- [ ] system.md와 config.json의 notes 동기화 (L-002)
- [ ] 프롬프트 엔지니어링 노하우 공개 금지 (L-004)

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
- [ ] npm test → 전체 통과 확인
- [ ] 새 기능에 테스트 추가했는가?
- [ ] npm run test:coverage → 커버리지 리그레션 없는지 확인

### 4단계: Git 커밋 & 푸시
- [ ] CHANGELOG.md 업데이트 (v0.XX 새 엔트리)
- [ ] git add . && git commit -m "v0.XX: 작업 요약"
- [ ] git push
- [ ] GitHub Actions CI 통과 확인
- [ ] Railway 자동 배포 확인
