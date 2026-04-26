# Folio Design System

> `public/css/style.css` 기반 실제 구현 기준.  
> 새 화면·컴포넌트 추가 시 여기서 토큰·패턴을 먼저 찾을 것.  
> 없으면 기존 패턴에서 파생 — 임의 하드코딩 금지.

---

## 1. 컬러 토큰

```css
/* 배경 계층 */
--bg:          #0A0E17   /* 앱 주 배경 */
--desktop-bg:  #050810   /* 데스크탑 외부 배경 */
--surface:     #131927   /* 카드·입력창·모달 배경 */

/* 경계선 */
--border:      #1E2A3A   /* 기본 선 */

/* 강조색 */
--accent:      #5B8FB9   /* 주요 액션·포인트 */
--accent-dim:  #3D6A8A   /* 비활성·보조 강조 */

/* 텍스트 계층 */
--text:        #E2E8F0   /* 주 텍스트 */
--text-muted:  #A8B5C8   /* 보조 텍스트 */
--text-dim:    #4A5568   /* 비활성·힌트 */

/* 기타 */
--msg-user:    #1A2744   /* 채팅 유저 말풍선 배경 */
```

### 사용 규칙
- 하드코딩된 컬러 값 금지. 반드시 토큰 변수 사용.
- `--accent` hover = `#4a7ea8` (약 10% 어둡게). 새 accent 버튼 추가 시 동일 적용.
- 에러 텍스트: `#e06c75` (`.field-error`). 토큰화 예정.
- 성공 텍스트: `#4CAF50` (`.field-feedback.success`).

---

## 2. 타이포그래피

폰트: **Pretendard** (`var(--font)`). monospace 계열 일절 금지.

### 스케일

| 용도 | font-size | font-weight | 사용처 |
|------|-----------|-------------|--------|
| 페이지 타이틀 | 20px | 800 | `.notif-inbox-title`, 섹션 헤딩 |
| 섹션 헤딩 | 18px | 700 | `.char-profile-fullname` |
| 카드 제목 | 15–16px | 600–700 | `.select-card-title`, `.char-name` |
| 본문 | 14px | 400 | `.char-desc`, `.notif-row-body` |
| 보조 본문 | 13px | 400 | `.session-preview`, `.notif-row-time` 류 |
| 캡션·레이블 | 11–12px | 500–600 | `form label`, `.notif-tab`, `.badge` |
| 마이크로 | 9–10px | 600–700 | `.char-card-stats`, `.badge-label` |

### 규칙
- `letter-spacing`: eyebrow/label 계열 `0.06–0.2em`, 본문 `0–0.03em`.
- 2줄 말줄임: `-webkit-line-clamp: 2` 패턴 사용 (`.char-name` 참고).
- iOS `font-size < 16px` input 포커스 줌인 → `@supports (-webkit-touch-callout: none)` 로 16px 적용.

---

## 3. 레이아웃 토큰

```css
--radius-card:  12px   /* 카드, 모달 패널, 이미지 */
--radius-btn:   8px    /* 버튼, 입력창 */
```

### 앱 셸
- 최대 너비: `430px` (모바일 단일 뷰)
- 높이: `min-height: 100dvh` (iOS Safari 대응, `100vh` fallback 병용)
- 구조: `#app` (flex column) → `.screen.active` (flex: 1) → `.bottom-nav`

### 공통 여백
- 화면 좌우 패딩: `18–20px`
- 섹션 간격: `24–32px`
- 카드 내부 패딩: `14–18px`

---

## 4. 버튼

### btn-primary — 주요 액션
```css
width: 100%; padding: 14px;
background: var(--accent); color: #fff;
border-radius: var(--radius-btn); font-size: 14px; font-weight: 600;
/* hover */ background: #4a7ea8;
```
사용처: 로그인, 저장, 다음으로, 대화 시작 등 CTA.

### btn-ghost — 보조 액션
```css
width: 100%; padding: 14px;
background: transparent; border: 1px solid var(--border);
color: var(--text-muted); font-size: 14px;
/* hover */ border-color: var(--text-dim); color: var(--text);
```
사용처: 취소, 닫기, 모달 하단 보조 버튼.

### btn-back — 뒤로가기
```css
background: none; border: none; font-size: 16px;
color: var(--text-muted); cursor: pointer;
min-height: 44px; min-width: 44px; display: flex; align-items: center;
```
사용처: 모든 화면 헤더 좌측 "←".

### btn-icon — 아이콘 버튼
```css
background: none; border: none; font-size: 17px;
color: var(--text-dim); padding: 6px 8px; border-radius: 8px;
/* hover */ background: var(--surface); color: var(--text);
```
사용처: 헤더 우측 아이콘 액션 (알림, 설정 등).

### btn-send — 전송
```css
width: 42px; height: 42px;
background: var(--accent); color: #fff;
border-radius: var(--radius-btn);
/* disabled */ background: var(--border); color: var(--text-dim);
```

### btn-delete-confirm — 파괴적 액션
```css
background: #c0392b; color: #fff;
/* hover */ background: #c94f4f;
```
사용처: 삭제 확인 모달.

### 공통 규칙
- `touch-action: manipulation` — `button, a` 전역 적용됨 (300ms 딜레이 제거).
- `min-height: 44px` — 모든 탭·소형 버튼 필수 (iOS 터치 타겟).
- `:active { opacity: 0.65 }` — `button, a` 전역 적용됨.
- `disabled` 처리: `disabled` attribute 대신 CSS 클래스 사용 (CLAUDE.md 금지 사항).

---

## 5. 카드

### char-card — 캐릭터 그리드 카드
```
aspect-ratio: 3/3.4  border-radius: 16px  overflow: hidden
이미지 + 오버레이(태그) + 상태 배지 + 번호 배지 구조
```
- 상태 배지: `.char-card-status-badge` + `.badge-new` / `.badge-hot` / `.badge-up`
- Coming Soon: `.char-card-coming-overlay` + `.char-card-soon-badge`

### session-card — 세션 목록
```
background: var(--surface);  border: 1px solid var(--border);
border-radius: var(--radius-card);  padding: 14px 16px;
```

### select-card — 선택형 카드 (빌더 등)
```
padding: 18px 16px;  border-radius: 14px;
아이콘(40×40) + 타이틀 + 설명 + 화살표 구조
/* hover */ border-color: var(--accent-dim); background: rgba(91,143,185,0.05);
```

### creator-card — 크리에이터 원형 카드
```
width: 72px;  아바타(64×64 원형) + 핸들명 구조
touch-action: manipulation  (pan-x 컨테이너 내부)
```

### genre-card — 장르 이미지 카드
```
width: 130px;  height: 170px;  border-radius: var(--radius-card);
배경이미지 + 그라디언트 오버레이 + 레이블/제목 구조
touch-action: manipulation  (pan-x 컨테이너 내부)
```

---

## 6. 폼

### form-group
```html
<div class="form-group">
  <label>레이블 <span class="required">*</span></label>
  <input type="text" placeholder="..." />
  <span class="field-error" id="xxx-err"></span>
</div>
```
- `label`: 11px, uppercase, `var(--text-dim)`
- `input/textarea`: `border: 1px solid var(--border)`, focus → `border-color: var(--accent)`
- iOS: font-size 16px (자동 줌 방지, `@supports` 조건 적용됨)

### field-feedback
```css
.field-feedback          /* 기본 상태 */
.field-feedback.checking /* 확인 중 — var(--text-dim) */
.field-feedback.success  /* 사용 가능 — #4CAF50 */
.field-feedback.error    /* 오류 — #e06c75 */
```
사용처: username 중복 확인 등 실시간 유효성.

### toggle-switch — ON/OFF 토글
```html
<label class="toggle-switch">
  <input type="checkbox" />
  <span class="toggle-thumb"></span>
</label>
```
- OFF: `var(--surface)` + `var(--text-dim)` 핸들
- ON: `rgba(accent, 0.18)` 배경 + `var(--accent)` 핸들

---

## 7. 오버레이 / 모달

모든 오버레이 공통 패턴:
- `display: none` (닫힘) / `.open { display: flex }` (열림)
- `position: fixed; inset: 0; background: rgba(0,0,0,0.55–0.7)`
- 패널은 하단에서 슬라이드업: `align-items: flex-end`

### delete-modal-overlay — 삭제 확인
```
z-index: 300
패널: border-radius: 16px 16px 0 0; padding: 24px 20px 32px
구조: 타이틀 + 설명 + [취소(ghost) / 삭제(delete-confirm)] 버튼
```

### auth-gate-overlay — 인증 게이트
```
z-index: 300
패널: border-radius: 16px 16px 0 0; padding: 28px 24px 36px
구조: 타이틀 + 설명 + [닫기(ghost) / 로그인하기(primary)] 버튼
열기: showAuthGate(title, desc, intendedPath)
닫기: closeAuthGate() / goToLogin() (로그인 이동 시)
```

### note-overlay — 메모 패널
```
z-index: 100
패널: 하단 슬라이드업
```

### char-profile-overlay — 캐릭터 프로필
```
z-index: 200; position: absolute (screen-chat 내부 기준)
닫힘 애니메이션: .closing { slideDown 0.22s }
```

### 레이어 계층
```
9999  #splash (초기화 후 제거), .model-picker
9998  .toast
 300  .delete-modal-overlay, .auth-gate-overlay
 200  .bottom-nav, .char-profile-overlay
 100  .note-overlay
  10  .chat-input-wrap (sticky 효과)
```

---

## 8. 토스트

```js
showToast('메시지', duration?)  // 기본 2000ms
```
- `position: fixed; bottom: 80px` (네비바 위)
- 자동 dismiss. 직접 닫기 없음.
- `pointer-events: none` — 클릭 이벤트 비차단.

---

## 9. 상태 배지

캐릭터 카드 우상단에 표시:

```html
<span class="char-card-status-badge badge-new">
  <span class="status-dot">●</span>
  <span class="badge-label">NEW</span>
</span>
```

| 클래스 | 색상 | 의미 |
|--------|------|------|
| `.badge-new` | 초록 rgba(30,160,90,0.7) | 신규 캐릭터 |
| `.badge-hot` | 빨강 rgba(210,50,50,0.7) | 인기 |
| `.badge-up` | 파랑 rgba(50,100,220,0.7) | 업데이트 |

`badge_override` 필드로 강제 지정, null이면 자동 계산.

---

## 10. 인터랙션 규칙

### 터치 (iOS Safari)
- `touch-action: manipulation` — `button`, `a` 전역 적용. `div/span onclick` 요소는 직접 추가.
- `min-height: 44px` — 모든 탭 가능 요소 필수.
- `:active { opacity: 0.65 }` — `button`, `a` 전역. 카드류는 `0.7`.

### 전환 애니메이션
| 용도 | 애니메이션 |
|------|------------|
| 모달 열기 | `slideUp 0.2–0.22s ease` |
| 모달 닫기 | `slideDown 0.22s ease forwards` |
| 팝오버 열기 | `fadeUp 0.12s ease` |
| 버튼/카드 상태 | `transition: 0.15s` |

### 스크롤 컨테이너
- 수평 스크롤: `overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch`
- 수평 드래그 슬라이더 (`creator-row`, `genre-row`): `touch-action: pan-x` + 자식에 `manipulation`
- 수직 스크롤: `overflow-y: auto` (`.screen`, `.notif-feed` 등)

### 비활성 상태
- 버튼: `opacity: 0.25–0.4; cursor: not-allowed` (`.btn-pg:disabled`, `.btn-regenerate:disabled` 참고)
- `disabled` attribute 단독 사용 금지 → CSS 클래스 병용 (CLAUDE.md 금지 사항 §4)

---

## 11. 화면 구조 패턴

### 기본 화면 (스크롤 가능)
```html
<div id="screen-xxx" class="screen">
  <div class="page-wrap">   <!-- flex column, padding: 0 0 40px -->
    <!-- 헤더 -->
    <!-- 콘텐츠 -->
  </div>
</div>
```

### 고정 레이아웃 화면 (내부 스크롤)
```html
<div id="screen-xxx" class="screen">
  <div class="notif-page-wrap">  <!-- height: 100%; overflow: hidden -->
    <div class="header">...</div>       <!-- flex-shrink: 0 -->
    <div class="tabs">...</div>         <!-- flex-shrink: 0 -->
    <div class="feed">...</div>         <!-- flex: 1; overflow-y: auto -->
  </div>
</div>
```
사용처: 알림함(`.notif-page-wrap`), 채팅 화면.

### 네비바 표시/숨김
```js
const noNavScreens = ['screen-chat', 'screen-builder-chat', ...];
```
`showScreen()` 호출 시 자동 처리. 새 화면 추가 시 `noNavScreens` 배열 업데이트.
