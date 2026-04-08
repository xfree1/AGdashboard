/**
 * weekUtils.js — 주차 ID 변환 공통 유틸
 *
 * 여러 파일에 중복된 주차 계산 로직을 한 곳으로 통합.
 * 모든 함수는 ISO 8601 주차 기준(목요일 포함 주)을 따른다.
 */

/**
 * weekId("YY.WW주") → 해당 주 토요일 Date
 * @param {string} weekId  예) "26.06주"
 * @returns {Date|null}
 */
export function weekIdToSat(weekId) {
  const m = String(weekId || '').match(/(\d{2})\.(\d{2})주/);
  if (!m) return null;
  const year    = 2000 + parseInt(m[1], 10);
  const weekNum = parseInt(m[2], 10);
  const jan4    = new Date(year, 0, 4);
  const dow     = jan4.getDay() || 7; // Mon=1 … Sun=7
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (dow - 1));
  const sat = new Date(week1Mon);
  sat.setDate(week1Mon.getDate() + (weekNum - 1) * 7 + 5);
  return sat;
}

/**
 * 토요일 Date → canonical weekId (ISO 주차 기준, "YY.WW주")
 * 연말-연초 경계 주차를 올바르게 처리한다.
 * @param {Date} sat
 * @returns {string}
 */
export function satToWeekId(sat) {
  const d = new Date(sat);
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dow); // 같은 주 목요일로 이동 (ISO 기준)
  const year      = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const weekNo    = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${String(year).slice(2)}.${String(weekNo).padStart(2, '0')}주`;
}

/**
 * weekId → { year, month }  (토요일 기준 달 귀속)
 * @param {string} weekId
 * @returns {{ year: number, month: number }|null}
 */
export function weekIdToYearMonth(weekId) {
  const sat = weekIdToSat(weekId);
  if (!sat) return null;
  return { year: sat.getFullYear(), month: sat.getMonth() + 1 };
}

/**
 * weekId → "MM.DD" 형식 날짜 문자열
 * @param {string} weekId
 * @returns {string}
 */
export function fmtWeekLabel(weekId) {
  const sat = weekIdToSat(weekId);
  if (!sat) return String(weekId);
  const yy = String(sat.getFullYear()).slice(2);
  const mm = String(sat.getMonth() + 1).padStart(2, '0');
  const dd = String(sat.getDate()).padStart(2, '0');
  const currentYear = new Date().getFullYear();
  return sat.getFullYear() !== currentYear ? `${yy}.${mm}.${dd}` : `${mm}.${dd}`;
}

/**
 * weekId → { year, month, satLabel }
 * TrendChart의 축/툴팁 레이블 생성에 사용.
 * @param {string} weekId
 * @returns {{ year: number|null, month: number|null, satLabel: string|null }}
 */
export function parseWeekParts(weekId) {
  const sat = weekIdToSat(weekId);
  if (!sat) return { year: null, month: null, satLabel: null };
  const mm = String(sat.getMonth() + 1).padStart(2, '0');
  const dd = String(sat.getDate()).padStart(2, '0');
  const yy = String(sat.getFullYear()).slice(2);
  const currentYear = new Date().getFullYear();
  const satLabel = sat.getFullYear() !== currentYear ? `${yy}.${mm}.${dd}` : `${mm}.${dd}`;
  return { year: sat.getFullYear(), month: sat.getMonth() + 1, satLabel };
}
