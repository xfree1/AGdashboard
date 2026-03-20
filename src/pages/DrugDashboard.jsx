import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import './DrugDashboard.css';

/* ─── 색상 ─── */
const MY_COLOR   = '#288cfa';   // 안국약품
const COMP_COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#a78bfa', '#06b6d4', '#f97316', '#84cc16'];

function getColor(vendor, myVendor, rankAmongOthers) {
  if (vendor === myVendor) return MY_COLOR;
  return COMP_COLORS[rankAmongOthers % COMP_COLORS.length];
}

/* ─── 포맷 ─── */
const fmtPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtNum = (v) => v == null ? '—' : v.toLocaleString();
const pctClass = (v) => v > 0 ? 'pos' : v < 0 ? 'neg' : '';

/* ─── 툴팁 ─── */
function MsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="dd-tooltip">
      <p className="dd-tooltip__label">{label}</p>
      {sorted.map((e, i) => (
        <p key={i} style={{ color: e.color }}>
          {e.name}: <strong>{e.value?.toFixed(1)}%</strong>
        </p>
      ))}
    </div>
  );
}

/* ─── KPI 카드 ─── */
function KPICard({ label, value, sub, delta, highlight }) {
  return (
    <div className={`dd-kpi ${highlight ? 'dd-kpi--highlight' : ''}`}>
      <p className="dd-kpi__label">{label}</p>
      <p className="dd-kpi__value">{value}</p>
      {sub && <p className="dd-kpi__sub">{sub}</p>}
      {delta != null && (
        <span className={`dd-badge dd-badge--${pctClass(delta)}`}>
          전주 {fmtPct(delta)}
        </span>
      )}
    </div>
  );
}

/* ─── 메인 ─── */
export default function DrugDashboard({ result, onReset }) {
  const [showTop, setShowTop] = useState(5);
  const [chartMode, setChartMode] = useState('ms');   // 'ms' | 'abs'

  const { drugName, myVendor, weeks, vendors, marketByWeek, msChartData, metric, fileName } = result;

  /* 우리 회사 데이터 */
  const me = vendors.find(v => v.name === myVendor);
  const others = vendors.filter(v => v.name !== myVendor);

  /* 최신 주차 M/S */
  const lastIdx   = weeks.length - 1;
  const prevIdx   = weeks.length - 2;
  const myMsLast  = me ? me.msPerWeek[lastIdx] * 100 : 0;
  const myMsPrev  = me && prevIdx >= 0 ? me.msPerWeek[prevIdx] * 100 : null;
  const myMsDelta = myMsPrev != null ? myMsLast - myMsPrev : null;

  /* 순위 */
  const myRank = vendors.findIndex(v => v.name === myVendor) + 1;

  /* 표시할 판매사 목록 (우리 + top N 경쟁사) */
  const displayVendors = useMemo(() => {
    const top = others.slice(0, showTop);
    return [me, ...top].filter(Boolean);
  }, [me, others, showTop]);

  /* 차트 데이터 */
  const chartData = useMemo(() => {
    if (chartMode === 'ms') return msChartData;
    // abs: 절대 수치
    return weeks.map((week, wi) => {
      const obj = { week };
      displayVendors.forEach(v => { obj[v.name] = Math.round(v.byWeek[wi]); });
      return obj;
    });
  }, [chartMode, msChartData, weeks, displayVendors]);

  const metricLabel = metric === 'qty' ? '처방량' : '처방건수';

  return (
    <div className="dd-root">
      {/* 헤더 */}
      <header className="dd-header">
        <div className="dd-header__left">
          <div className="dd-header__logo">
            <span className="dd-logo-mark">AG</span>
            <span className="dd-logo-name">board</span>
          </div>
          <div className="dd-header__title-wrap">
            <h1 className="dd-header__title">{drugName}</h1>
            <p className="dd-header__sub">
              {fileName} · {metricLabel} 기준 · {weeks[0]} ~ {weeks[lastIdx]}
            </p>
          </div>
        </div>
        <button className="dd-btn dd-btn--ghost" onClick={onReset}>
          ↑ 새 파일 업로드
        </button>
      </header>

      <main className="dd-content">

        {/* KPI 그리드 */}
        <section className="dd-kpi-grid">
          <KPICard
            label={`M/S (${weeks[lastIdx]})`}
            value={`${myMsLast.toFixed(1)}%`}
            delta={myMsDelta}
            highlight
          />
          <KPICard
            label="시장 순위"
            value={`${myRank}위`}
            sub={`/ ${vendors.length}개사`}
          />
          <KPICard
            label={`${weeks[lastIdx]} ${metricLabel}`}
            value={fmtNum(me ? Math.round(me.byWeek[lastIdx]) : 0)}
          />
          <KPICard
            label="6주 평균 M/S"
            value={`${me ? (me.msTotal * 100).toFixed(1) : 0}%`}
          />
        </section>

        {/* M/S 추이 차트 */}
        <section className="dd-card">
          <div className="dd-card__header">
            <p className="dd-card__title">
              주차별 {chartMode === 'ms' ? 'M/S (%)' : `${metricLabel} (절대값)`}
            </p>
            <div className="dd-controls">
              <div className="dd-btn-group">
                {[['ms','M/S (%)'],['abs','절대값']].map(([k,l]) => (
                  <button key={k} className={`dd-btn-sm ${chartMode===k?'active':''}`} onClick={() => setChartMode(k)}>{l}</button>
                ))}
              </div>
              <div className="dd-btn-group">
                {[3,5,10].map(n => (
                  <button key={n} className={`dd-btn-sm ${showTop===n?'active':''}`} onClick={() => setShowTop(n)}>Top {n}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="dd-card__body">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#8fa3bb', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#8fa3bb', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => chartMode === 'ms' ? `${v}%` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip content={<MsTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#4a6080' }} />
                {displayVendors.map((v, i) => {
                  const color = getColor(v.name, myVendor, i - 1);
                  const isMe  = v.name === myVendor;
                  return (
                    <Line
                      key={v.name}
                      type="monotone"
                      dataKey={v.name}
                      stroke={color}
                      strokeWidth={isMe ? 2.5 : 1.5}
                      strokeDasharray={isMe ? undefined : '4 2'}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 주차별 M/S 바차트 (우리만) */}
        <section className="dd-card">
          <div className="dd-card__header">
            <p className="dd-card__title">안국약품 주차별 M/S</p>
          </div>
          <div className="dd-card__body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={weeks.map((week, wi) => ({
                  week,
                  'M/S (%)': me ? parseFloat((me.msPerWeek[wi] * 100).toFixed(2)) : 0,
                }))}
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#8fa3bb', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8fa3bb', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, 'M/S']} />
                <ReferenceLine y={me ? me.msTotal * 100 : 0} stroke="#8fa3bb" strokeDasharray="4 2" label={{ value: '평균', fill: '#8fa3bb', fontSize: 10 }} />
                <Bar dataKey="M/S (%)" fill={MY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 판매사 순위 테이블 */}
        <section className="dd-card">
          <div className="dd-card__header">
            <p className="dd-card__title">판매사 순위 ({metricLabel} 기준)</p>
            <span className="dd-mono dd-muted">전체 {vendors.length}개사</span>
          </div>
          <div className="dd-table-wrap">
            <table className="dd-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>판매사</th>
                  {weeks.map(w => <th key={w}>{w}</th>)}
                  <th>6주 합계</th>
                  <th>평균 M/S</th>
                  <th>전주대비</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, rank) => {
                  const lastMs   = v.msPerWeek[lastIdx] * 100;
                  const prevMs   = prevIdx >= 0 ? v.msPerWeek[prevIdx] * 100 : null;
                  const delta    = prevMs != null ? lastMs - prevMs : null;
                  const isMe     = v.name === myVendor;
                  return (
                    <tr key={v.name} className={isMe ? 'dd-table__my-row' : ''}>
                      <td className="rank">{rank + 1}</td>
                      <td className="name">
                        {isMe && <span className="dd-my-badge">우리</span>}
                        {v.name}
                      </td>
                      {v.byWeek.map((val, wi) => (
                        <td key={wi} className="val">{Math.round(val).toLocaleString()}</td>
                      ))}
                      <td className="val total">{Math.round(v.total).toLocaleString()}</td>
                      <td className="pct">{(v.msTotal * 100).toFixed(1)}%</td>
                      <td className={`pct ${delta != null ? pctClass(delta) : ''}`}>
                        {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}
