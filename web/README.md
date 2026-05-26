# Folio Web (React 마이그레이션)

Next.js 14 App Router + TypeScript. Phase A 마이그레이션 산출물.

## 개발

```bash
# 1. 의존성 설치 (한 번만)
cd web
npm install

# 2. 백엔드 서버 실행 (별도 터미널, 프로젝트 root에서)
cd ..
npm run dev    # http://localhost:3000

# 3. 프론트 dev 서버
cd web
npm run dev    # http://localhost:3001
```

`next.config.mjs`의 rewrites가 `/api/*` 요청을 자동으로 `localhost:3000`으로 프록시.

## 구조

```
web/
├── app/                # App Router (페이지·레이아웃)
│   ├── layout.tsx      # 루트 레이아웃 (#app 셸)
│   ├── page.tsx        # / 홈
│   └── globals.css     # 디자인 토큰 + 리셋
├── lib/                # 유틸 (API 클라이언트 등) — 추가 예정
├── components/         # 재사용 컴포넌트 — 추가 예정
├── store/              # Zustand 상태 — 추가 예정
├── public/             # 정적 자산 (이미지 등)
├── next.config.mjs
├── tsconfig.json
└── package.json
```

## 디자인 시스템

`../docs/DESIGN_SYSTEM.md` 참조.
컬러 토큰은 `app/globals.css`의 `:root`에 1:1 이식됨.

## 마이그레이션 작업 항목

`../docs/PRODUCTION_PLAN.md` Phase A 섹션 참조.
