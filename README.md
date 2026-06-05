# Site

작은 서비스들을 모아두는 개인 실험실. 정적 사이트로 빌드해서 GitHub Pages에 올려요.

## 스택

- **Next.js 15** (App Router) — `output: 'export'` 정적 빌드
- **React 19**
- **TypeScript** — `strict` + `noUncheckedIndexedAccess`
- **Tailwind CSS v4** — CSS-first 테마, 코럴 액센트 1색
- **ESLint** (next config) + **Prettier**

## 구조

```
src/
  app/                  # Next.js 라우트
    page.tsx            # 랜딩
    (lab)/              # 실험실 라우트 그룹
      page.tsx          # /lab 인덱스
      ladder/page.tsx   # /lab/ladder
  components/
    ui/                 # 공용 UI 프리미티브 (Button, Card, Input, Container)
    site/               # 셸 (Header)
  services/             # 서비스 모듈
    _registry.ts        # 서비스 메타데이터 — 여기 한 줄 추가하면 끝
    ladder/             # 사다리 타기
      logic.ts          # 순수 로직 (서버/클라 공용)
      components/       # 클라이언트 UI
.github/workflows/
  deploy.yml            # main push → build → Pages
```

## 새 서비스 추가하는 법

1. `src/services/<id>/` 폴더 만들기 (`logic.ts`는 순수 함수로, `components/`는 클라)
2. `src/app/(lab)/<route>/page.tsx` 만들기
3. `src/services/_registry.ts`에 메타데이터 한 줄 추가

그러면 랜딩/실험실 인덱스에 자동으로 카드가 떠요.

## 로컬 개발

```bash
npm install
npm run dev          # http://localhost:3000
```

다른 도메인/서브경로로 띄우고 싶으면 `BASE_PATH` 환경변수 설정:

```bash
BASE_PATH=/ my-other-repo npm run dev
```

## 빌드 & 배포

- `main`에 푸시하면 Actions가 빌드해서 GitHub Pages에 배포
- 첫 배포: Settings → Pages → Source = **GitHub Actions**
- URL: `https://<owner>.github.io/Site/`

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 로컬 개발 서버 |
| `npm run build` | 정적 export (`out/`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier 포맷 |
| `npm run format:check` | 포맷 검사 |
