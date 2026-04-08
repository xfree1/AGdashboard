/**
 * tokens.js — JS-accessible design tokens (mirrors variables.css)
 *
 * ECharts 등 CSS 변수를 직접 쓸 수 없는 컨텍스트에서 사용.
 * 값을 바꿀 때는 variables.css 와 함께 수정할 것.
 */

/* ── 색상 ─────────────────────────────────────────── */
export const COLOR_ACCENT          = '#288cfa'; // --color-accent
export const COLOR_CHART_MARKET    = '#93c5fd'; // --color-chart-market
export const COLOR_CHART_MS        = '#288cfa'; // --color-chart-ms (= COLOR_ACCENT)
export const COLOR_CHART_VENDOR    = '#60a5fa'; // --color-chart-vendor
export const COLOR_TEXT_3          = '#94a3b8'; // --text-3
export const COLOR_SURFACE         = '#ffffff'; // --color-surface
export const COLOR_TEXT_PRIMARY    = '#0f1f3d'; // --color-text-primary
export const COLOR_TEXT_SECONDARY  = '#3d5470'; // --color-text-secondary
export const COLOR_BORDER          = '#dce6f0'; // --color-border

/* ── 폰트 ─────────────────────────────────────────── */
export const FONT_SANS = "'Pretendard Variable', Pretendard, sans-serif"; // --font-sans

/* ── 사이드바 약 목록 도트 색상 (인덱스 순) ────────── */
export const DRUG_DOT_COLORS = [
  '#2563eb', '#f59e0b', '#10b981', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16',
];

/* ── 도넛 차트 기타 판매사 색상 ─────────────────────── */
export const DONUT_OTHER_COLORS = [
  '#b0bec5', '#90a4ae', '#78909c',
  '#607d8b', '#546e7a', '#455a64',
];
