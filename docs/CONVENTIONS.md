# Folio — Coding Conventions

> 실제 코드에서 추출한 패턴. 새 파일 작성 시 이 기준을 따른다.

---

## 1. 공통

- **언어**: Node.js 서버는 CommonJS (`require` / `module.exports`). ESM 사용 안 함.
- **상수**: `UPPER_SNAKE_CASE`. 파일 상단에 모아서 선언.
- **변수/함수**: `camelCase`.
- **섹션 구분 주석**: `// ── 섹션명 ─────────────────────────────────────`
- **왜(Why)가 자명하지 않을 때만** 주석 작성. 코드가 하는 일은 이름으로 표현.

---

## 2. 서버 (`server.js` / `routes/`)

### 라우터 구조
```js
const express = require('express');
const router  = express.Router();
const { stmt } = require('../db');

// 핸들러...

module.exports = router;
```

### API 응답 형태
| 상황 | 형태 |
|------|------|
| 성공 | `res.json({ ... })` |
| 클라이언트 오류 | `res.status(400).json({ error: '한국어 메시지' })` |
| 인증 필요 | `res.status(401).json({ error: '로그인이 필요합니다' })` |
| 서버 오류 | `res.status(500).json({ error: '...' })` |

### 인증 가드
```js
if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
```
모든 인증 필요 라우트의 첫 줄에 위치.

### 입력 검증
- 외부 경계(API 요청)에서만 Joi로 검증.
- 내부 함수 간 호출에는 검증 불필요.

### 에러 핸들링
```js
try {
  // ...
} catch (err) {
  console.error('컨텍스트 설명:', err.message);
  res.status(500).json({ error: '실패 메시지' });
}
```

---

## 3. 데이터베이스 (`db/index.js`)

### SQL 실행 방식
- **모든 SQL은 `stmt` 객체의 prepared statement로만 실행.**
- 라우터에서 `db.prepare()` 직접 호출 금지. `stmt.XXX`로만 접근.
- 단, strftime format·테이블명 등 파라미터화 불가능한 동적 쿼리는 `db/index.js`에 헬퍼 함수로 분리하고 export. (→ D-011)

### 마이그레이션 패턴
```js
try { db.exec(`ALTER TABLE ... ADD COLUMN ...`); } catch (_) {}
```
멱등성 보장. 새 컬럼 추가는 항상 이 패턴 사용.

### 스키마 규칙
- 타임스탬프: `INTEGER DEFAULT (unixepoch())`
- UUID 기반 외부 ID: `public_id TEXT`
- 내부 PK: `INTEGER PRIMARY KEY AUTOINCREMENT`
- 외래키: `ON DELETE CASCADE` 또는 `ON DELETE SET NULL` 명시

---

## 4. 프론트엔드 (`public/js/app.js`)

### 함수 네이밍
| 역할 | 패턴 | 예시 |
|------|------|------|
| 화면 초기화 | `loadXxx()` | `loadMypage()` |
| 화면 채우기 | `populateXxx()` | `populateIntroScreen()` |
| 상태 업데이트 | `updateXxx()` | `updateLikeBtn()` |
| 이벤트 핸들러 | `onXxx()` / `handleXxx()` | - |
| 헬퍼 | `setXxx()` | `setTabCount()` |

### 내부 전용 상태
```js
const _likedIds = new Set();  // _prefix = 모듈 내부 전용
```

### DOM 렌더링
- 화면 단위 전체 교체: `el.innerHTML = \`...\``
- 그리드에 아이템 추가: `el.insertAdjacentHTML('beforeend', html)`
- innerHTML 안에서 accent 색 등 스타일 분기가 필요하면 `<span>` 분리

### API 호출
```js
const res  = await fetch('/api/...', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...}) });
const data = await res.json();
```

---

## 5. 스타일 (`public/css/style.css`)

### 클래스 네이밍
`컴포넌트-요소` 또는 `컴포넌트-요소-수식어` (BEM-lite)

```
intro-hero
intro-hero-img
mp-profile-card
mp-edit-btn
mypage-tab-count
```

### 디자인 토큰
CSS 변수를 직접 쓰지 말고 토큰 변수 사용:
- `var(--font)` — Pretendard 고정. monospace 계열 금지.
- `var(--accent)` — 포인트 색상
- `var(--bg)`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--muted)`

### 레이아웃
- 모바일 단일 뷰 기준 (430px). 미디어 쿼리 없음.
- 섹션 구분: `/* ── 섹션명 ─── */`

---

## 6. 캐릭터 (`prompts/characters/`)

### 디렉토리 구조
```
prompts/characters/{id}/
  config.json   ← 메타데이터 + UI 표시 정보
  system.md     ← AI 행동 규칙 (영문 산문)
```

### config.json 필수 필드
```json
{
  "id": "",
  "name": "",
  "nameEn": "",
  "role": "",
  "about": { "world": "", "avg_length": "", "tone": "", "traits": [], "opening_line": "" },
  "notes": { "creator_note": "", "rules": [], "tip": "", "notes_by": "", "notes_date": "" }
}
```

### notes 작성 규칙
→ `docs/LESSONS.md` 참조.  
요약: 관찰 가능한 특성·창작 의도·독자 가이드만 작성.  
프롬프트 파라미터·가드레일·Safety 구조 노출 금지.

### system.md 작성 규칙
- 영문으로 작성 (모델 지시문은 영문이 더 명확)
- 블록 구조: `## Block N: 제목`
- 첫 줄: `You are [Name]. You exist in this world.`

---

## 7. 파일/디렉토리 배치

```
server.js          진입점, 미들웨어 + 라우터 마운트
routes/            라우터 1파일 = 1도메인
db/index.js        스키마 + 마이그레이션 + stmt 객체 (전부 여기)
lib/               외부 API 클라이언트 래퍼
prompts/           시스템 프롬프트 + 캐릭터 설정
data/              JSON 기반 런타임 데이터 (코드 아님)
public/            정적 파일 (SPA)
docs/              내부 문서 (CONVENTIONS.md, LESSONS.md 등)
```
