# React 마이그레이션 진행 일지

> 매 작업 단위마다 무엇을 했는지·뭘 빠뜨렸는지·뭘 발견했는지 기록.
> 체크리스트(`MIGRATION_CHECKLIST.md`)와 짝.
> CHANGELOG와는 별개 — CHANGELOG는 사용자용 릴리즈 노트, History는 작업 추적용.

---

## 사용 규칙

### 새 작업 시작 전
1. 작업 영역 결정 (어떤 화면 / 컴포넌트)
2. 체크리스트의 해당 섹션 열기
3. 시작 전 자동 체크 5종 수행 (체크리스트 부록 참조)

### 새 작업 끝난 후
1. 종료 후 자동 체크 5종 수행 (체크리스트 부록 참조)
2. 아래에 "작업 항목" 추가
3. 체크리스트의 해당 ✅ 항목 마킹

### 발견 사항 / 누락 사항
- 작업 중 발견된 원본의 빠뜨린 디테일 → "발견" 섹션에 기록 + 체크리스트에 새 항목 추가
- 다른 화면에 영향 주는 사항 → 영향 받는 화면 항목에 메모

---

## 진행 항목

### 2026-05-05 (Day 0) — Rewind & Harness 셋업

**상태**: 초기 시도 후 rewind, 하네스 구축 단계

**작업**:
- 이전 시도 (`fc98c81`) 까지의 work는 `dev-attempt-2026-05-05` 브랜치에 스냅샷 보존
- `dev` 브랜치를 `2709b6a` (Next.js scaffolding + 포트 분리)로 hard reset + force push
- `MIGRATION_CHECKLIST.md` 작성 — 모든 화면·컴포넌트·연결·상태 분기·API 매트릭스 명문화
- `MIGRATION_HISTORY.md` (이 파일) 시작

**현재 상태 (커밋 `2709b6a` 기준)**:
- ✅ Next.js 14 + TypeScript 설치 완료 (`web/package.json`, `tsconfig.json`)
- ✅ 포트 3001 설정 (Express 3000과 분리)
- ✅ globals.css에 디자인 토큰 + 기본 셸 이식
- ✅ 빈 placeholder layout/page
- ⛔ 그 외 모든 화면·컴포넌트 미구현

**다음 작업**:
- [ ] (Day 1) globals.css 디자인 토큰 검증 + 필요 시 보강
- [ ] (Day 1) `lib/api.ts` + `lib/types.ts` (백엔드 연결 기초)
- [ ] (Day 1) `store/auth.ts` + `<AuthBootstrap>` (세션 복원)

**발견 / 회고**:
- 첫 시도에서 빠뜨린 디테일: 로고 스타일 (Foli + o-dots), VIEW ALL 버튼, 캐릭터 stat (▲ ❤), 태그 # prefix, NEW/HOT/UP 배지 로직, BROADCAST 배너, 알림 미읽음 배지, 4번째 캐릭터(adult_only)
- 첫 시도에서 본 CSS 로드 깨짐 원인: globals.css의 `@import url(...)` Pretendard 로드가 Next.js dev에서 stylesheet 전체 로드 실패 야기 — 해결: layout `<head>`의 `<link>` 태그로 분리
- 첫 시도 때 라우트 연결 거의 안 한 채로 wave 진행 — 이번엔 화면마다 연결지점 동시 처리할 것

---

<!-- 다음 작업부터 아래에 추가 -->

### 2026-05-05 (Day 1) — 기반 (globals + API client + Auth store)

**작업 범위**: 모든 화면이 의존하는 공통 인프라.

**사전 체크 통과**:
- ✅ 참조: CLAUDE.md / DESIGN_SYSTEM.md / CONVENTIONS.md / LESSONS L-011·L-013·L-014·L-017
- ✅ 원본 코드: style.css 1~150, app.js initAuth, db/index.js users 스키마
- ✅ 체크리스트 섹션: 0(참조) / 1(CSS 전략) / 3.x(글로벌 - AuthBootstrap)

**구현**:
- `web/app/globals.css` 검증/보강
  - `@import url(Pretendard)` 제거 → layout `<link>`로 이동 (첫 시도의 stylesheet 깨짐 버그 회피)
  - `::-webkit-scrollbar` 룰 추가 (원본 117~125)
  - `.screen-page` 유틸 클래스 추가 (원본 .screen 패턴, 라우트 페이지에 적용)
- `web/app/layout.tsx`
  - Pretendard `<link>` 추가
  - `<AuthBootstrap />` 마운트
- `web/lib/api.ts`
  - fetch wrapper (`credentials: 'include'`)
  - ApiError class (status / data / message)
  - get/post/patch/put/delete 헬퍼
  - `rawFetch()` (스트리밍용 — 채팅에서 사용)
- `web/lib/types.ts`
  - User / Character / Persona / Session / Message / Notification / Bookmark / Curation / CreatorProfile
  - SQLite boolean을 0|1로 표현
- `web/store/auth.ts`
  - Zustand store: user / ready / demoAvailable
  - **L-011 race condition 방지**: initAuth 응답 시 `get().user`가 있으면 덮어쓰지 않음
  - initAuth / checkDemoMode / logout / demoLogin / setUser
- `web/components/AuthBootstrap.tsx`
  - 마운트 시 1회 initAuth + checkDemoMode (UI 렌더 X)

**종료 체크**:
- ✅ 프론트 type-check 통과
- ✅ 프론트 build 통과 (홈 138B placeholder 상태)
- ✅ 백엔드 jest 49개 통과
- ⏸ 시각 비교 / 모바일 / 연결 — 이번 단계는 인프라만, 화면 없음
- ✅ History 기록 (이 항목)
- ✅ 체크리스트 0·1·3.x AuthBootstrap 부분 마킹은 다음 화면 만들 때 결과로 확인

**다음 작업 (Day 2)**:
- [ ] `<Toast>` (z 9998) + `<Splash>` (z 9999) — 글로벌 UI 기초
- [ ] 모달 공통 CSS (`Modal.module.css`) + `<DeleteConfirmModal>` 재사용 컴포넌트
- [ ] 작은 버튼 컴포넌트들 (`<BtnPrimary> <BtnGhost> <BtnBack> <BtnIcon> <BtnSend>`) — 또는 화면 작업 중 동시 추출

**발견 / 회고**:
- L-011 패턴이 store/auth.ts에 명시적으로 주석 처리됨 — 다음에 다른 사람(또는 나)이 봐도 race 의도 알 수 있게
- types.ts에 SQLite boolean을 `0 | 1`로 명시 — JS truthy 평가 시 `!!user.adult_content_enabled` 패턴 사용 필요
