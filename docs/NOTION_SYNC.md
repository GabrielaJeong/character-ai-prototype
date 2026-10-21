# Folio — Notion 동기화

> repo → Notion **단방향** 파이프라인. `scripts/sync-notion.js` + GitHub Actions.
> 작성 기준: v0.33

---

## 1. 설계 원칙

| 원칙 | 이유 |
|------|------|
| **단방향 (repo → Notion)** | 양방향은 충돌 해결이 필요해 비용이 급증한다. Notion은 "읽는 창", 편집은 repo에서. |
| **상태 파일 없음** | Notion 쪽 대상을 루트 페이지의 자식 중 **제목으로** 찾는다. Actions가 매번 새로 체크아웃해도 매니페스트를 커밋해 되돌릴 일이 없다. |
| **내용 해시로 변경 감지** | 페이지 교체는 블록당 `DELETE`라 비싸다. 안 바뀐 문서는 건너뛴다. |
| **의존성 0** | Node 내장 모듈 + 전역 `fetch`만 쓴다. CI에서 `npm ci` 가 필요 없다. |

---

## 2. 1회 설정

### 2-1. Notion 연결(Connection) 만들기

Notion 설정 → **개발자 도구 → 연결** 탭 → **+ 신규 연결**
(<https://www.notion.so/profile/integrations>. 과거 "내부 통합(Internal Integration)" 이
"연결(Connection)" 으로 이름이 바뀌었다.)

1. **연결 이름**: 아무거나 (예: `Folio Sync`)
2. **인증 방법**: **API 토큰** 선택
   - `API 토큰` — 워크스페이스 범위 정적 토큰. **이쪽을 쓴다.**
   - `OAuth` — 로그인 사용자 범위. 브라우저 동의 흐름이 필요해 CI에서 쓸 수 없다.
3. 생성 후 권한(Capabilities)에서 콘텐츠 **읽기 / 업데이트 / 삽입** 을 모두 켠다
   — 읽기만 있으면 미러링이 403으로 죽는다
4. 시크릿 복사 — `ntn_...` 또는 `secret_...` 으로 시작

> 개발자 도구의 **Worker** 탭은 이 파이프라인과 무관하다. 동기화 스크립트는
> API 토큰으로 REST API를 직접 호출한다.

### 2-2. 대상 페이지를 연결에 공유

동기화 루트가 될 Notion 페이지를 열고:

**우측 상단 `⋯` → 연결 → 2-1 에서 만든 연결 선택**

> 이 단계를 빼먹으면 스크립트가 `루트 페이지를 열 수 없습니다` 로 멈춘다.
> 연결을 만드는 것만으로는 어떤 페이지에도 접근할 수 없다 — Notion API는
> 명시적으로 공유된 페이지만 본다.

### 2-3. GitHub Secrets 등록

repo → Settings → Secrets and variables → Actions → **New repository secret**

| 이름 | 값 |
|------|-----|
| `NOTION_TOKEN` | 2-1 에서 복사한 `ntn_...` |
| `NOTION_PAGE_ID` | 루트 페이지 URL 또는 ID (URL 그대로 붙여넣어도 파싱된다) |

---

## 3. 실행

### 자동 (GitHub Actions)

`.github/workflows/sync-notion.yml`

| 트리거 | 조건 |
|--------|------|
| `push` | `main`/`dev` 에 `CHANGELOG.md`·`docs/**`·`data/curation.json`·`prompts/characters/**` 변경이 포함된 push |
| `schedule` | 매일 03:00 KST — 소스 변경 없이도 커밋 로그 DB를 따라잡기 위함 |
| `workflow_dispatch` | 수동 실행. `only`·`force` 입력 지원 |

`concurrency: notion-sync` 로 묶여 있다. 두 실행이 겹쳐 같은 페이지를 중복 생성하는 것을 막기 위함이다.

> `actions/checkout` 에 **`fetch-depth: 0`** 이 필요하다. 기본값(얕은 체크아웃)에서는
> git 이력이 없어 커밋 로그 동기화가 조용히 비어버린다.

### 수동 (로컬)

```bash
# .env 에 NOTION_TOKEN / NOTION_PAGE_ID 를 넣고
npm run sync:notion

# 토큰 없이 변환만 검사 (CI 사전 점검용)
node scripts/sync-notion.js --dry-run

# 대상 한정 / 강제 재작성
node scripts/sync-notion.js --only=docs,log
node scripts/sync-notion.js --only=chars,log --force
```

| 플래그 | 동작 |
|--------|------|
| `--only=docs,log,chars,curation` | 동기화 대상 한정 (기본: 전부). `docs`=문서 10종, `log`=커밋 로그, `chars`=캐릭터 DB, `curation`=큐레이션 페이지 |
| `--dry-run` | 쓰기 없이 계획만 출력. 토큰이 없으면 변환 검사만 수행 |
| `--force` | 내용이 안 바뀐 페이지도 다시 쓴다 |
| `--adopt` | 제목이 같은 **기존** 페이지를 미러로 인수한다 (기존 내용 삭제, 되돌릴 수 없음) |

---

## 4. Notion 쪽 구조

스크립트가 루트 페이지 아래에 다음을 만든다 (없으면 생성, 있으면 갱신):

```
루트 페이지 (NOTION_PAGE_ID)
├── 📄 업데이트 로그          ← CHANGELOG.md
├── 📄 현재 상태              ← docs/CURRENT_STATE.md
├── 📄 프로덕션 플랜           ← docs/PRODUCTION_PLAN.md
├── 📄 의사결정 기록           ← docs/DECISIONS.md
├── 📄 디자인 시스템           ← docs/DESIGN_SYSTEM.md
├── 📄 코딩 컨벤션             ← docs/CONVENTIONS.md
├── 📄 레슨                   ← docs/LESSONS.md
├── 📄 보안                   ← docs/SECURITY.md
├── 📄 컷오버 체크리스트        ← docs/CUTOVER_CHECKLIST.md
├── 📄 세션 체크리스트          ← docs/SESSION_CHECKLIST.md
├── 📄 큐레이션 데이터          ← data/curation.json (키별 표)
├── 🗄 커밋 로그 (DB)          ← git log, 해시로 upsert
└── 🗄 캐릭터 (DB)             ← prompts/characters/*/config.json, ID로 upsert
```

### 커밋 로그 DB 속성

`제목` · `해시` · `날짜` · `종류`(feat/fix/perf/…) · `범위` · `작성자`

커밋은 불변이라 **신규 행만 추가**한다. 기존 행은 건드리지 않는다.

### 캐릭터 DB 속성

`이름` · `ID` · `상태` · `역할` · `소속` · `태그` · `등급` · `세계관` · `톤` · `평균 분량` · `첫 대사` · `소유자`

본문에는 프로필 표·소개·성격·제작자 노트·규칙이 들어간다.

---

## 5. 동작 원리

### 변경 감지

미러 페이지 **맨 위 callout** 에 원본 경로와 내용 해시를 박아둔다:

```
🔄 ⟳ repo 동기화 · CHANGELOG.md · a1b2c3d4e5f6 · 2026-10-21 09:14 UTC
```

다음 실행에서 이 블록 하나만 읽어(`page_size=1`) 해시를 비교한다. 같으면 건너뛴다.
`--force` 는 이 검사를 무시한다.

> 이 callout을 Notion에서 지우면 다음 실행이 해당 페이지를 전부 다시 쓴다. 손상은 없다.

### 덮어쓰기 가드

제목이 같아도 **동기화 표식이 없는 페이지는 건너뛴다.** 사람이 쓴 문서를 제목이
같다는 이유로 지우는 사고를 막기 위함이다. 실행 끝에 건너뛴 목록과 선택지를 출력한다.
인수하려면 `--adopt` 를 명시해야 한다 (되돌릴 수 없음).

### 루트 안내문

동기화 루트 맨 위에 `[repo 자동 동기화]` callout 을 한 번 심는다. 이미 있으면 건드리지
않는다. Notion append 는 항상 끝에 붙으므로, 내용이 있는 페이지를 루트로 쓰면 안내문이
맨 아래로 간다 — 전용 빈 페이지를 루트로 쓰는 쪽을 권하는 이유 중 하나다.

### 페이지 교체

Notion API에는 블록 벌크 삭제가 없다. 그래서 교체는 `자식 전체 나열 → 개별 DELETE → 새로 append`
순서로 돌고, DELETE는 동시 4개로 흘리며 `429` 는 지수 백오프로 흡수한다.

문서 하나가 수백 블록이라(CHANGELOG 530, 레슨 419) **해시 스킵이 성능의 핵심**이다.
전체 강제 재작성(`--force`)은 수 분이 걸린다.

### Notion API 제약 대응

| 제약 | 대응 |
|------|------|
| `children` append 100개/요청 | 100개씩 끊어 순차 전송 |
| `rich_text` content 2000자 | `chunkPlain()` 으로 분할 |
| `rich_text` 배열 100개 | 초과분 절단 |
| `multi_select` 이름에 쉼표 불가 | 공백으로 치환 |
| `code` language 허용 목록 고정 | `LANGS` 화이트리스트, 미지원은 `plain text` |
| 표 행도 100 상한 공유 | 95행에서 절단 |

---

## 6. 알아둘 점

- **Notion 쪽 편집은 덮어쓰인다.** 미러 페이지(문서·큐레이션)와 캐릭터 DB 본문은 원본이 바뀔 때마다 교체된다. Notion에서 직접 고치지 말고 repo를 고쳐라.
- **캐릭터 DB의 속성값도 덮어쓰인다.** 단, repo에 없는 속성을 Notion에서 **추가**하면 그 열은 보존된다 (스크립트가 자기 속성만 PATCH한다). 메모·담당자 같은 열을 붙여 쓰기에 적합하다.
- **커밋 로그 행은 보존된다.** 신규 추가만 하므로 Notion에서 붙인 메모가 남는다.
- **문서 제목이 식별자다.** `DOCS` 의 `title` 을 바꾸면 새 페이지가 생기고 기존 페이지는 고아로 남는다. 바꿀 때는 Notion 쪽 기존 페이지를 직접 지워라.
- **동기화 대상 문서를 늘리려면** `scripts/sync-notion.js` 의 `DOCS` 배열에 `{ file, title }` 한 줄을 추가하면 된다. 이 문서(`NOTION_SYNC.md`)와 `CLAUDE.md` 는 의도적으로 제외돼 있다.
- **최근 300커밋만** 올린다 (`COMMIT_LIMIT`). 그 이상 과거를 넣으려면 값을 올리고 `--only=log` 로 한 번 돌려라.

---

## 7. 트러블슈팅

| 증상 | 원인 / 조치 |
|------|------------|
| `루트 페이지를 열 수 없습니다` | 2-2 공유 단계 누락. 페이지 `⋯ → 연결` 에서 연결 추가 |
| `::warning:: … 미설정` 후 종료(exit 0) | Secrets 미등록. 설정 전에는 CI를 깨뜨리지 않도록 의도된 동작 |
| `git 이력을 읽지 못했습니다` | checkout 의 `fetch-depth: 0` 누락 |
| `Notion 400 … is not a valid option` | `select`/`multi_select` 값 문제. 보통 쉼표 — `pMulti`/`pSelect` 가 치환하지만 신규 속성 추가 시 확인 |
| 동기화가 매우 느림 | 정상. 문서가 바뀌면 블록 수백 개를 교체한다. 안 바뀐 문서는 건너뛴다 |
| 페이지가 중복 생성됨 | 동시 실행. `concurrency` 그룹이 막지만, 수동 실행과 push가 겹쳤다면 Notion에서 중복분을 지워라 |

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/sync-notion.js` | 동기화 오케스트레이션 (CLI 엔트리) |
| `lib/notion.js` | Notion REST 클라이언트 — 재시도·페이지네이션·동시성 |
| `lib/notionMarkdown.js` | 마크다운 → Notion 블록 변환기 |
| `.github/workflows/sync-notion.yml` | Actions 트리거 |
