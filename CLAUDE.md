## 행동 지침

### 1. 스타일 규칙

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

### 2. 디자인 토큰 규칙

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

### 3. 파일·코드 규칙

- Supabase 쿼리는 `src/utils/supabaseLoader.js`에서만 작성
- 새 페이지 생성 시 전용 `.css` 파일 함께 생성
- 컴포넌트 파일명 PascalCase, CSS 클래스명 kebab-case
