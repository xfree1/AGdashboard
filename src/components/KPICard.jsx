import React from 'react';
import './KPICard.css';

/**
 * KPICard
 * @param {string} label       - 지표 이름
 * @param {string|number} value - 메인 수치 (포맷 완료된 문자열 권장)
 * @param {string} [unit]      - 단위 (원, %, 건 등)
 * @param {number} [change]    - 전기 대비 변화율 (숫자, e.g. 12.3 / -5.2)
 * @param {string} [subLabel]  - 보조 설명 (e.g. "전월 대비")
 * @param {string} [trend]     - 'up' | 'down' | 'flat'
 * @param {boolean} [loading]  - 로딩 상태
 */
export default function KPICard({
  label,
  value,
  unit,
  change,
  subLabel = '전기 대비',
  trend,
  loading = false,
}) {
  const autoTrend = trend ?? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat');
  const changeAbs = change !== undefined ? Math.abs(change) : null;

  return (
    <div className={`kpi-card ${loading ? 'kpi-card--loading' : ''}`}>
      <p className="kpi-card__label">{label}</p>

      <div className="kpi-card__value-row">
        <span className="kpi-card__value">
          {loading ? '—' : value}
        </span>
        {unit && !loading && (
          <span className="kpi-card__unit">{unit}</span>
        )}
      </div>

      {changeAbs !== null && !loading && (
        <div className={`kpi-card__change kpi-card__change--${autoTrend}`}>
          <span className="kpi-card__change-arrow">
            {autoTrend === 'up' ? '▲' : autoTrend === 'down' ? '▼' : '—'}
          </span>
          <span className="kpi-card__change-value">
            {changeAbs.toFixed(1)}%
          </span>
          <span className="kpi-card__change-label">{subLabel}</span>
        </div>
      )}

      {loading && <div className="kpi-card__skeleton" />}
    </div>
  );
}
