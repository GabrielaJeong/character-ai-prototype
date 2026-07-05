# PRODUCTION_PLAN.md

> Folio 프로토타입 → 프로덕션 마이그레이션 마스터 플랜.
> 결정 사항 / 단계 / 체크리스트 / 미결정 사항 추적.

**최종 업데이트**: 2026-05-05
**현재 단계**: Phase A 진입 (React 마이그레이션)

---

## 1. Phase 0 결정 사항 (확정)

| 항목 | 결정 | 비고 |
|------|------|------|
| 타깃 시장 | **한국 only** | 다국어·GDPR 추후 |
| 트래픽 인프라 | **AWS 이전 계획 중** | 시점 미정, Railway → AWS |
| 수익모델 | **결제 (토큰/구독) 우선** | 별도 설계 진행 중 |
| MVP 타임라인 | 미정 | 분기 단위 추정 |
| 팀 구성 | **1인 개발** | 컨텍스트 스위칭 최소화 우선순위 |
| 자본 | 자비 (보수적) | 무료 티어 우선 활용 |

---

## 2. 마이그레이션 순서 (최종)

```
[Phase A] React 마이그레이션          ← 지금 진행
    ↓
[Phase D] 결제 시스템 통합            ← 백엔드 설계 중
    ↓
[Phase B] PostgreSQL 마이그레이션     ← AWS 이전과 묶기
    ↓
[Phase C] AWS 인프라 이전
    ↓
[Phase E] 컴플라이언스·운영 자동화
```

**순서 근거**:
- React 먼저: 백엔드 API 형태 거의 안 바뀜 → 데이터 마이그레이션 영향 최소
- 결제는 백엔드 작업이라 React와 병행 가능 (UI는 React 쪽에서 처음부터 구현)
- PG·AWS는 함께 가는 게 효율적 — AWS RDS PostgreSQL 자연스러운 매칭
- 컴플라이언스는 결제 시점에 필요 (전자상거래법 등)

---

## 3. Phase A — React 마이그레이션 (현재 진행)

### 결정된 스택

| 항목 | 선택 | 근거 |
|------|------|------|
| 프레임워크 | **Next.js 14 App Router** | SEO·SSR / AWS·Vercel 모두 지원 / D-014 권장 |
| 상태 관리 | **Zustand** | 규모 대비 가벼움 / React Context보다 디버깅 용이 |
| 스타일 | **현재 CSS 토큰 유지** | DESIGN_SYSTEM.md 그대로 이식 / Tailwind는 추후 |
| 데이터 페칭 | **fetch + SWR** (또는 TanStack Query) | 캐싱·재검증 자동, 보일러플레이트 최소 |
| 폼 | **react-hook-form** | 기존 vanilla validation 대비 단순 |
| 라우팅 | **Next.js 파일 기반** | 현재 ROUTES 배열 → 폴더 구조 매핑 |
| 백엔드 | **현재 Express 서버 유지** | API 호출 형태 그대로, mock 인터페이스 가능 |

### 작업 분해 (예상 3~4주)

**Week 1 — 환경 + 기반**
- [ ] Next.js 14 프로젝트 생성 (`apps/web` 또는 별도 리포)
- [ ] 기존 디자인 토큰 (`style.css` `:root` 변수) → globals.css 이식
- [ ] 글로벌 layout (스플래시 / bottom-nav / 토스트)
- [ ] AuthContext (Zustand) — `_currentUser` 대체
- [ ] API 클라이언트 (`lib/api.ts`) — fetch wrapper + 에러 처리
- [ ] 라우팅: 파일 기반 (app/[route]/page.tsx) 매핑 테이블 작성

**Week 2 — 핵심 화면**
- [ ] `/` 홈 (캐릭터 그리드)
- [ ] `/character/[id]` 인트로
- [ ] `/persona/select`, `/persona/new` (linked / standalone 모드)
- [ ] `/character/[id]/chat` 채팅 (스트리밍은 별도 hook)
- [ ] `/explore` 탐색 + 큐레이션

**Week 3 — 보조 화면**
- [ ] `/login`, `/signup`, `/reset-password`
- [ ] `/mypage` (페르소나/캐릭터/책갈피 탭)
- [ ] `/notification` 알림함
- [ ] `/creator/@[username]` 크리에이터 프로필
- [ ] `/builder`, `/builder/chat`, `/builder/manual` 빌더
- [ ] 404 페이지

**Week 4 — 통합 + 안정화**
- [ ] 인증 게이트 + 리다이렉트 로직 (`L-011` `L-017` 패턴 그대로)
- [ ] 모바일 인터랙션 검증 (`L-012` 체크리스트)
- [ ] 데모 모드 (`DEMO_MODE` 분기)
- [ ] E2E 시나리오 수동 테스트 + 자동 테스트 일부
- [ ] Vercel 또는 별도 호스팅 배포
- [ ] 기존 Folio 도메인 cutover

### 기존 자산 활용

| 자산 | React로 옮길 때 |
|------|----------|
| `docs/DESIGN_SYSTEM.md` | 컴포넌트 1:1 매핑 |
| `app.js` 4000줄 | 화면 단위로 쪼개서 컴포넌트화 |
| `style.css` 5200줄 | CSS Modules 또는 그대로 globals.css |
| API 엔드포인트 | 그대로 사용 (`/api/*`) |
| 인증·세션 | express-session 그대로, fetch에 `credentials: 'include'` |
| L-XXX 학습들 | 그대로 적용 (특히 모바일·인증 게이트) |

### 백엔드 Mock 처리

PostgreSQL은 아직 안 옮기므로:
- 현재 SQLite + Volume 그대로 유지
- DB 계층 변경은 Phase B에서
- React는 백엔드를 **API 형태로만 인식** → Mock 가능

선택적으로 dev 환경용 mock API 추가:
- `apps/web/lib/api.mock.ts` — `?mock=true` 또는 env로 분기
- 백엔드 다운/마이그레이션 중에도 프론트 개발 지속 가능

### 마이그레이션 진행 방식 (확정)

**전면 재작성** 선택 (D-014 권장):
- 점진적 마이그레이션은 두 코드베이스 동시 유지 부담
- 1인 개발이라 컨텍스트 스위칭 비용이 더 큼
- 기존 vanilla 코드는 **참조용**으로 git에 보존

**확정된 결정**:
- **코드베이스 위치**: 같은 리포 + `web/` 폴더 (분리 안 함, 1인 컨텍스트 스위칭 최소화)
- **Cutover**: 전부 React로 옮기고 한 번에 (부분 cutover 안 함)
- **호스팅 (Phase A)**: **Vercel** (Next.js 최적, 보유 중)
- **호스팅 (Phase C)**: AWS Amplify 또는 S3+CloudFront (백엔드 AWS 이전 시)

**기존 코드 운명**:
- 새 React 앱이 안정화될 때까지 root 코드는 유지 (백엔드용 + 참조용)
- 새 React 앱은 `web/` 폴더에서 독립 진행
- Cutover 시점에 도메인 전환 (root는 백엔드 API 전용으로 전환)

---

## 4. Phase D — 결제 시스템 (백엔드 설계 중)

### 결정된 사항 (현재)
- 우선순위: **결제 우선** (다른 항목보다 빠르게)
- 한국 시장 → **Toss Payments 또는 PortOne (구 아임포트)** 우선 검토
- 토큰 충전 모델 / 구독 모델 어느 쪽인지 미정

### Open Questions
- 결제 PG 선택 기준 (수수료·통합 편의성·문서)
- 토큰 vs 구독 vs 하이브리드
- 환불 정책

---

## 5. Phase B — PostgreSQL 마이그레이션 (AWS 이전과 묶기)

### 예정 스택
- **ORM**: Drizzle (better-sqlite3 → pg, 타입 안전)
- **DB**: AWS RDS PostgreSQL 또는 Railway PostgreSQL (트래픽 따라)
- **마이그레이션 도구**: 직접 작성 (덤프 변환 + 검증)

### 의존 사항
- AWS 이전 결정 (Phase C와 함께)
- 현재 SQLite + Volume (D-017)으로 임시 대응 중 → 시급도 낮음

---

## 6. Phase C — AWS 인프라 이전

### 예정 작업
- ECS Fargate 또는 EC2 (트래픽 따라)
- RDS PostgreSQL
- S3 (이미지 업로드)
- CloudFront (CDN)
- Secrets Manager (env)
- CloudWatch (로그·모니터링)

### Open Questions
- Vercel vs AWS S3+CloudFront (React 앱 호스팅)
- 멀티 리전 여부 (한국만이면 단일 리전 ap-northeast-2)

---

## 7. 미결정 사항 (Open Questions)

- [ ] React 새 코드베이스 위치: 모노레포(`apps/web`) vs 별도 리포
- [ ] CSS 전략: 현재 globals.css 그대로 vs CSS Modules vs Tailwind
- [ ] 백엔드 mock 인터페이스 필요성 (Phase B 전까지 SQLite 직접 사용해도 됨)
- [ ] 결제 PG 선택 (Toss Payments / PortOne / Stripe Korea)
- [ ] 토큰 vs 구독 모델
- [ ] AWS 이전 트리거 (MAU 임계값?)
- [ ] 청소년 보호 본인인증 도입 시점 (PASS / NICE)
- [ ] 콘텐츠 모더레이션 자동화 (LLM 기반) 도입 시점

---

## 8. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| React 마이그레이션 일정 초과 | 다른 Phase 지연 | 화면 우선순위 정하고 핵심부터 cutover (홈/채팅 먼저) |
| 인증 플로우 회귀 (L-011, L-017) | 유저 이탈 | 기존 LESSONS.md 체크리스트 가져가서 작업 단위 검증 |
| 모바일 UX 회귀 (L-012) | 모바일 유저 이탈 | DESIGN_SYSTEM.md 기준 컴포넌트 단위 모바일 수동 QA |
| 백엔드 안정성 | 데이터 손실 | 현재 Volume(D-017)으로 영속화. PG 마이그레이션 전까지 유지 |
| 결제 PG 통합 복잡도 | Phase D 일정 초과 | Toss Payments 표준 통합 가이드 따라가기, 커스텀 최소화 |

---

## 9. 체크포인트 기준 (Phase A 종료 조건)

> **배포/cutover 실행 절차**: `docs/CUTOVER_CHECKLIST.md` (아키텍처·env·Volume·SSE 검증·롤백).
> 배포 설정 코드(next.config 프록시·middleware `BACKEND_ORIGIN`)는 준비 완료. R5-1(파일 영속성)이 배포 하드 전제조건.

Phase A는 다음 조건 만족 시 종료 선언:

- [ ] 모든 화면이 React로 이식 완료 + 동일 기능
- [ ] 모바일 핵심 인터랙션 동작 검증 (L-012 체크리스트)
- [ ] 인증 게이트 모든 플로우 동작 (L-011, L-017 패턴)
- [ ] 데모 모드 동작
- [ ] CI 통과 (테스트 추가 포함)
- [ ] 프로덕션 도메인 cutover 완료 후 1주 안정 운영
- [ ] LESSONS·DECISIONS에 React 마이그레이션 학습 기록

---

## 9.5 보안·인프라 백로그 (Codex R5, 2026-05-28)

> React 프론트 마이그레이션 **스코프 밖**의 기존 백엔드/배포 인프라 이슈.
> 원본 SPA 시절부터 존재했거나 배포 환경 작업이라, 마이그레이션 흐름과 분리하여 별도 처리 (ML-013).
> cutover 전 또는 프로덕션 안정화 단계에서 일괄 처리.

| # | 심각도 | 항목 | 위치 | 메모 |
|---|---|---|---|---|
| ~~R5-1~~ | ~~Critical~~ | ✅ **코드 완료** — 파일 영속성(경로 env화 + 부팅 시드) | `lib/paths.js` + 라우트/`server.js` | 런타임 파일을 `RUNTIME_DATA_DIR`(Volume) 하위로. `seedRuntimeData()`가 프리빌트 seed-if-missing. dev는 no-op(경로=repo). **남은 것: Railway Volume 생성 + `RUNTIME_DATA_DIR=/data` env**(배포 실행). 상세: `docs/CUTOVER_CHECKLIST.md` §2·§4 |
| ~~R5-2~~ | ~~High~~ | ✅ **해결** — 탈퇴/유저삭제 파일 정리 | `lib/paths.deleteUserFiles`, `routes/auth.js`, `routes/admin.js` | 아바타 + 본인 제작 캐릭터 dir·이미지 삭제(프리빌트/타인 보존). DELETE `/me` + admin DELETE `/users`에서 호출 |
| ~~R5-3~~ | ~~High~~ | ✅ **해결** — Builder 비용/메모리 보호 | `routes/builder.js`, `server.js` | 입력길이 4000자 제한 + `builderSessions` Map **TTL 30분·최대 500**(메모리 누수 차단) + 전용 `builderLimiter`(15분 30req). 비로그인 데모 흐름은 의도 유지 |
| ~~R5-4~~ | ~~Medium~~ | ✅ **해결** — 아바타 서버측 크기 검증 | `routes/auth.js` PATCH `/me` | `lib/imageData.parseImageDataUrl`로 decoded 5MB 검증. (이전 확장자 파일 정리는 R5-2 파일정리와 함께) |
| R5-5 | Medium | R3/R4 보안 경계 회귀 테스트 부재 | `tests/` | 캐릭터 생성/삭제/system 권한, adult 단건 gate, sessions safety 소유권, 탈퇴 파일 정리, Builder limiter |
| ~~R5-6~~ | ~~Low~~ | ✅ **해결** — 루트 lint flat config 전환 완료 | `eslint.config.js` | 원인: `eslintrc.json`(dot 누락)이라 미작동 + ESLint v10 flat config 요구. flat config 작성, public/·web/ ignore, jest globals 분리. error 0. 잔여 warning 9개(기존 백엔드 unused var)는 별도 정리 대상 |
| ~~R5-7~~ | ~~Medium~~ | ✅ **해결** — 캐릭터 생성 이미지 서버측 크기 검증 | `routes/characters.js` POST `/create` | `parseImageDataUrl` 공용 헬퍼로 decoded 5MB 검증. 파일 생성 전 검증해 orphan dir 방지 |
| ~~R5-8~~ | ~~Low~~ | ✅ **해결** — 알림 단건 read 소유권 | `routes/notifications.js`, `db/index.js` markOneRead | INSERT를 `SELECT ... WHERE n.id=? AND (user_id IS NULL OR user_id=me)`로 변경 — 본인/broadcast만 read row 생성 |
| ~~R5-9~~ | ~~Medium~~ | ✅ **해결** — PV 집계에 비화면 요청 혼입 | `server.js` PV 미들웨어 | Codex 2차 QA: `/.well-known/*`(devtools) 등이 앱 PV로 집계(120중 68건). GET만 + `/.well-known`·파일형 경로(마지막 세그먼트에 `.`) 제외. 과거 junk 68행 정리(120→52) |

> **2026-06-03 Codex R8** 처리: Creator adult 필터 즉시 수정. 이미지 서버검증·알림 read는 R5-7/R5-8 등록.
> **2026-06-05 처리(사용자 "백로그 미루지 말자")**: R5-3(Builder limiter/Map TTL/입력길이)·R5-4/R5-7(이미지 서버검증)·R5-8(알림 read) **완료**. Codex 2차 QA의 PV 비화면 혼입은 R5-9로 **완료**.
> **남은 컷오버 관문(2개 + 1)**: **R5-1**(파일 영속성 Critical, *코드 아닌 배포/스토리지 결정*), **R5-2**(탈퇴 파일정리 High — R5-1 스토리지 결정에 종속되어 R5-1과 함께 처리하기로), R5-5(회귀테스트 권장). Builder **비인증 자체는 의도된 데모 정책**(결함 아님).

---

## 10. 참고 문서

- `docs/DECISIONS.md` — D-014 (React), D-017 (DB 영속화)
- `docs/LESSONS.md` — L-011~L-017 (마이그레이션 시 회귀 방지)
- `docs/DESIGN_SYSTEM.md` — 토큰·컴포넌트 1:1 이식 기준
- `docs/SECURITY.md` — 보안 정책 (React에서도 동일 적용)
- `docs/CONVENTIONS.md` — 코딩 규칙 (React 컨벤션은 추후 보강)
- `CHANGELOG.md` — 현재 v0.30 시점
