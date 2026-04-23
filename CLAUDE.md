## 행동 지침

### . 스타일 규칙

- 하드코딩 최소화 — 가능한 모든 스타일 값은 CSS 변수 사용
  - 색상          → `--color-*`
  - 여백·간격     → `--space-*`
  - 폰트 패밀리   → `--font-sans` / `--font-mono`
  - 폰트 크기     → `--text-*`
  - 모서리        → `--radius-*`
  - 그림자        → `--shadow-*`
  - 전환          → `--transition-*`

- 단, 아래와 같은 경우에 한해 예외적으로 직접 값 사용 가능
  - `1px` border (hairline)
  - 브라우저 기본값 대응
  - 정밀한 UI 보정이 필요한 경우

- 인라인 `style=""` 사용 금지 — 모든 스타일은 CSS 파일에서만 작성

- 새 변수는 반드시 `src/styles/variables.css`의 `:root` 기존 그룹 내에 추가

---

### . 디자인 토큰 규칙

- 변수는 **semantic(의미 기반)** 으로 우선 정의
  - 예: `--color-primary`, `--space-md`, `--radius-lg`

- 필요 시 primitive 토큰도 함께 정의
  - 예:
    - `--color-blue-500`
    - `--color-gray-100`

- semantic → primitive 매핑 구조 유지
  ```css
  --color-primary: var(--color-blue-500);
  ```

---

### . UI 컴포넌트 스타일 기준

- **이전/다음 버튼** — 새로 만드는 모든 페이지네이션·월 네비게이션 버튼은 아래 스타일 기준을 따른다
  ```css
  padding: 5px var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  cursor: pointer;
  /* hover */
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-dim);
  /* disabled */
  opacity: 0.35;
  cursor: not-allowed;
  ```
  참고 구현: `src/pages/DataPreview.css` `.preview-col-btn`

---

### . 파일·코드 규칙

- Supabase 쿼리는 `src/utils/supabaseLoader.js`에서만 작성
- 새 페이지 생성 시 전용 `.css` 파일 함께 생성
- 컴포넌트 파일명 PascalCase, CSS 클래스명 kebab-case

---

## 새 페이지 생성 체크리스트

새 페이지/컴포넌트를 만들 때 아래 항목을 순서대로 확인한다.

### 파일
- [ ] `PageName.jsx` + `PageName.css` 쌍으로 생성
- [ ] `App.js`에 Route 등록
- [ ] CSS 파일을 JSX에서 import

### 폰트
- [ ] 루트 컨테이너 클래스에 `font-family: var(--font-sans)` 선언
- [ ] Recharts 축/툴팁 등 SVG 영역은 CSS 상속이 안 되므로 `fontFamily: FONT_SANS` 명시 (`src/styles/tokens.js` 참조)
- [ ] 인라인 `style=""` 금지 — 모든 폰트·색상은 CSS 클래스로

### 스타일
- [ ] 색상·간격·크기 전부 CSS 변수 사용 (`--color-*`, `--space-*`, `--text-*` 등)
- [ ] 하드코딩 px 값 금지 (hairline `1px` border, 정밀 UI 보정 제외)
- [ ] 새 변수 필요 시 `src/styles/variables.css` `:root`에 추가

### ESLint (Vercel CI=true → warning도 에러)
- [ ] import했으나 쓰지 않는 변수 없을 것
- [ ] 선언했으나 쓰지 않는 변수 없을 것
- [ ] `useEffect` / `useMemo` dependency array 누락 없을 것

### 최종
- [ ] `npm run build` 로컬 실행 → 에러 0개 확인 후 커밋

---

## 배포 주의사항
- Vercel은 CI=true 환경이라 ESLint warning도 error로 처리함
- 코드 작성 시 미사용 변수(no-unused-vars) 반드시 제거할 것
- useEffect/useMemo dependency array 누락 없을 것
- 배포 전 로컬에서 `npm run build` 실행해서 에러 없는지 확인할 것