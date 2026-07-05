# CUTOVER_CHECKLIST.md — Next 앱 프로덕션 배포 (Phase A 종료)

> Vanilla SPA(`public/`) → Next 앱(`web/`) cutover 실행 체크리스트.
> PRODUCTION_PLAN §9(Phase A 종료 조건)·§9.5(R5 백로그) 연계.
> **현재 상태**: 배포 설정 코드 준비 완료(next.config 프록시·middleware env). 아래 ⛔ 항목은 실행 전 처리 필요.

---

## 1. 아키텍처 (Phase A 확정 = Vercel + Railway 2개)

```
 브라우저
   │  (single origin = Vercel 도메인만)
   ▼
[Vercel : Next 앱 (web/)]
   │  next.config rewrites 프록시: /api /images /icons /uploads
   ▼
[Railway : Express + SQLite + 파일]   ← DB이전(Postgres)·AWS는 Phase B/C
```

**핵심: 프록시 방식이라 브라우저는 Vercel 도메인 하나만 본다(same-origin).**
→ 세션 쿠키가 first-party로 유지되어 **크로스도메인 인증 문제 없음**(CORS/SameSite=None 불필요).

---

## 2. ✅ R5-1/R5-2 코드 구현 완료 — Railway Volume만 생성하면 됨

### 2-1. R5-1 파일 영속성 — **코드 완료(방식 A: 부팅 시드)**
런타임-mutable 파일(아바타·제작 캐릭터·큐레이션 업로드·admin 편집물)을 `lib/paths.js`로 중앙화.
- **`RUNTIME_DATA_DIR` env 지정 시**(Railway Volume, 예 `/data`) 런타임 쓰기가 그 하위로 감:
  `/data/characters` `/data/models` `/data/images` `/data/uploads` `/data/data`(curation·history) + `DB_PATH=/data/chat.db`
- **부팅 시 `seedRuntimeData()`** 가 repo 프리빌트/시드를 **seed-if-missing**(force:false)으로 복사 → 프리빌트/신규는 채워지고 **런타임·admin 편집물은 보존**.
- **미지정(로컬 dev)** 이면 경로가 기존 repo와 동일 → 동작 무변경, 시드 skip.
- static 서빙: `server.js`가 `/images`·`/uploads`를 `IMAGES_DIR`/`UPLOADS_DIR`에서 먼저 서빙 후 public 폴백.
- 검증: seed 로직(멱등·보존)·dev 무변경·전 라우트 load 확인.

→ **남은 것은 Railway에서 Volume 생성 + env 설정뿐**(§4). 코드 작업 없음.
> 주의: 프리빌트 '업데이트'는 /data에 이미 있으면 전파 안 됨(seed-if-missing). 프리빌트 교체 시 해당 파일 수동 삭제 후 재배포. L-015/L-016: 마운트는 `/data`(코드 폴더 `/app` 금지).

### 2-2. R5-2 탈퇴 시 파일 정리 — **코드 완료**
`lib/paths.deleteUserFiles(userId)`: 아바타(`user_N.*`) + 본인 제작 캐릭터 dir·이미지 삭제(프리빌트/타인 것 보존).
`routes/auth.js DELETE /me` + `routes/admin.js DELETE /users`에서 호출. 검증: 픽스처로 본인만 삭제·타인/프리빌트 보존 확인.

---

## 3. ⚠️ 스테이징에서 반드시 검증 (잠재 블로커)

### 3-1. SSE 스트리밍이 Vercel rewrites 프록시를 통과하는가 ⭐
**채팅이 SSE 스트리밍**(`/api/chat`). Vercel rewrites가 프록시 응답을 **버퍼링하면 스트리밍이 깨짐**(한 번에 와버림). 
→ **스테이징에서 실제 채팅 1회**로 토큰이 흐르듯 오는지 확인. 깨지면 대안:
- 채팅 SSE만 Railway 직접 호출(`NEXT_PUBLIC_API_URL`)로 빼고 그 엔드포인트에 CORS+`SameSite=None;Secure` — 단 인증 쿠키 복잡도 증가.
- 또는 Railway 앞에 자체 도메인 두고 same-origin 구성.

### 3-2. 어드민 미들웨어 server-side fetch
`web/middleware.ts`가 `BACKEND_ORIGIN`으로 `/api/auth/me` 호출. Vercel Edge에서 Railway로 도달하는지 + 쿠키 포워딩 확인.

---

## 4. Railway (백엔드) 설정

- [ ] **Volume 생성·마운트 `/data`** (코드 폴더 `/app` 금지 — L-016)
- [ ] env 확인:
  - **`RUNTIME_DATA_DIR=/data`** ← R5-1 런타임 파일 루트(부팅 시 프리빌트 자동 시드)
  - `DB_PATH=/data/chat.db`
  - `SESSION_SECRET`(필수), `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
  - `NODE_ENV=production` → 세션쿠키 `secure:true` 활성 ([server.js](../server.js) L142)
  - `app.set('trust proxy', 1)` 이미 설정됨 ✅ (프록시 뒤 secure 쿠키/rate-limit 정상)
- [ ] 백엔드 공개 도메인 확보(예: `https://folio-api.up.railway.app`) → Vercel `BACKEND_ORIGIN`에 사용
- [ ] (선택) 기존 admin.html은 Railway가 계속 서빙 → `/admin`은 백엔드 직접도 접근 가능하나, **운영 어드민은 Vercel `/admin`(Next) 사용**

## 5. Vercel (프론트) 설정

- [ ] New Project → **Root Directory = `web`**
- [ ] Framework = Next.js (자동 감지)
- [ ] env:
  - `BACKEND_ORIGIN = https://<railway-backend-domain>` ← rewrites + middleware 공용 (코드 준비됨)
  - `NEXT_PUBLIC_API_URL`은 **비워둠**(빈 값) → 클라가 same-origin `/api` 호출, rewrites가 프록시
- [ ] 배포 → Vercel 프리뷰 URL에서 §6 스모크 테스트
- [ ] predev 훅은 dev 전용이라 Vercel 빌드 영향 없음

## 6. 스모크 테스트 (프리뷰 URL)

- [ ] 홈/탐색/캐릭터 인트로 렌더 + 이미지(/images 프록시) 표시
- [ ] **로그인** → 새로고침 유지(쿠키 first-party 확인). "로그인 기억하기" 30일/세션 동작
- [ ] **채팅 SSE 스트리밍**(§3-1) — 토큰이 흐르듯 오는지 ⭐
- [ ] 페르소나 생성/아바타 업로드(5MB 서버검증), 빌더 1회
- [ ] **어드민**: 비로그인/비어드민 `/admin` → `/`로 redirect(middleware), 어드민 로그인 → 진입·차트·테이블·저장
- [ ] 알림 read, 북마크 등 부가 동작

## 7. 도메인 cutover

- [ ] 스테이징 OK 후, 기존 Folio 도메인을 Vercel로 전환(DNS/도메인 연결)
- [ ] Railway 백엔드는 `BACKEND_ORIGIN` 도메인 유지(프론트가 프록시로 의존)
- [ ] cutover 후 **1주 안정 운영 모니터링**(PRODUCTION_PLAN §9 종료조건)

## 8. 롤백

- [ ] 문제 시 도메인을 다시 **기존 Railway SPA(`public/`)** 로 되돌리면 즉시 복구(백엔드/DB 동일이라 데이터 영향 없음). Vercel은 독립이라 떼어내기 쉬움.

---

## 9. 준비 완료 / 남은 작업 요약

| 항목 | 상태 |
|---|---|
| next.config prod 프록시(`BACKEND_ORIGIN`) | ✅ 코드 준비 |
| middleware `BACKEND_ORIGIN` 단일화 | ✅ 코드 준비 |
| `trust proxy`·세션 secure·DB_PATH | ✅ 기존 적용 |
| **R5-1 파일 영속성(경로 env화 + 부팅 시드)** | ✅ **코드 완료** — Railway Volume 생성 + `RUNTIME_DATA_DIR=/data`만 남음 |
| **R5-2 탈퇴 파일정리** | ✅ **코드 완료** (`deleteUserFiles`) |
| SSE-over-proxy 검증 | ⚠️ 스테이징에서 |

> **배포 전 남은 실행 작업**: ① Railway Volume `/data` 생성 + env(`RUNTIME_DATA_DIR`·`DB_PATH`·`BACKEND_ORIGIN`) ② Vercel 프로젝트(root=`web`, `BACKEND_ORIGIN`) ③ 스테이징 스모크(특히 SSE) ④ 도메인 전환. **코드 준비는 완료.**

> **다음 실제 코드 작업 후보**: R5-1 경로 env화(가장 큰 덩어리). 원하면 이걸 다음으로 진행.
