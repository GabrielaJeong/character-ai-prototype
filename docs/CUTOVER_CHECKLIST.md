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

## 2. ⛔ 실행 전 반드시 처리 (코드 작업 남음)

### 2-1. R5-1 파일 영속성 (Critical) — **배포의 하드 전제조건**
Railway는 재배포 시 컨테이너 디스크가 초기화됨. 아래가 **휘발**:
- `public/images/` — 유저 아바타, 제작 캐릭터 이미지
- `public/uploads/` — 큐레이션 업로드 이미지
- `prompts/characters/char_*` — 빌더 제작 캐릭터
- `db/chat.db` — 이미 `DB_PATH` env로 분리됨 ✅

**복잡성**: `prompts/characters/`·`public/images/`는 **repo에 같이 들어있는 프리빌트(이화 등)** 와 **런타임 생성물**이 섞여 있음. 단순히 폴더를 Volume으로 옮기면 프리빌트가 사라짐.

**권장 설계**(미구현):
- 런타임 쓰기 경로를 env로 분리: `UPLOADS_DIR`·`USER_IMAGES_DIR`·`USER_CHARS_DIR` → Railway Volume(`/data/...`).
- 프리빌트는 repo 경로 유지. 로더(`loadAllCharacters`, 이미지 서빙)가 **두 경로를 모두** 조회.
- 또는 부팅 시 프리빌트를 Volume으로 1회 시드.
- 코드 영향: `IMAGES_DIR`·`UPLOADS_DIR`·`CHARS_DIR` 하드코딩 위치(아래) 전부 env화.
  - `routes/auth.js` `routes/characters.js` `routes/admin.js` `routes/bookmarks.js` `routes/creator.js` + `server.js` static 서빙.
- L-015/L-016: Volume 마운트 경로는 **코드 디렉터리와 분리**(`/data`), `/app/...`에 마운트 금지.

### 2-2. R5-2 탈퇴 시 파일 정리 (High) — R5-1과 함께
`routes/auth.js DELETE /me`가 DB만 지움. R5-1로 파일 위치 확정 후, 해당 유저의 제작 캐릭터 dir·이미지·아바타 삭제 로직 추가. (경로가 Volume이냐 S3냐에 따라 삭제 방식이 달라서 R5-1 종속.)

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

- [ ] Volume 생성·마운트(`/data`), R5-1 경로 env 연결 (위 2-1)
- [ ] env 확인:
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
| **R5-1 파일 영속성(경로 env화 + Volume + 프리빌트 분리)** | ⛔ **미구현 — 배포 전 필수** |
| **R5-2 탈퇴 파일정리** | ⛔ R5-1과 함께 |
| SSE-over-proxy 검증 | ⚠️ 스테이징에서 |

> **다음 실제 코드 작업 후보**: R5-1 경로 env화(가장 큰 덩어리). 원하면 이걸 다음으로 진행.
