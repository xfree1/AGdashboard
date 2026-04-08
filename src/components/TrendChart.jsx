import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { parseWeekParts } from '../utils/weekUtils';
import {
  COLOR_CHART_MARKET   as MARKET_COLOR,
  COLOR_CHART_MS       as MS_COLOR,
  COLOR_TEXT_3         as TEXT_3,
  COLOR_SURFACE        as SURFACE,
  COLOR_TEXT_PRIMARY   as TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY as TEXT_SECONDARY,
  COLOR_BORDER         as BORDER,
  FONT_SANS,
} from '../styles/tokens';

const CHART_PERIODS = [
  { label: '3개월', value: '3M', weeks: 13 },
  { label: '1년',   value: '1Y', weeks: 52 },
];

function fmtCompact(v) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(2)}억`;
  if (v >= 10000)     return `${(v / 10000).toFixed(1)}만`;
  if (v >= 1000)      return `${(v / 1000).toFixed(1)}천`;
  return String(v);
}

function fmtAxis(v) {
  if (v >= 100000) return `${(v / 10000).toFixed(0)}만`;
  if (v >= 10000)  return `${(v / 10000).toFixed(1)}만`;
  if (v >= 1000)   return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

export default function TrendChart({ allWeeks, vendorsSorted, myVendor, metricLabel }) {
  const [period, setPeriod] = useState('3M');
  const periodConfig = CHART_PERIODS.find(p => p.value === period);

  const chartWeeks = useMemo(
    () => allWeeks.slice(-periodConfig.weeks),
    [allWeeks, periodConfig.weeks],
  );
  const chartWeekIndices = useMemo(
    () => chartWeeks.map(w => allWeeks.indexOf(w)),
    [chartWeeks, allWeeks],
  );

  const weeklyRaw = useMemo(() =>
    chartWeeks.map((w, wi) => {
      const idx    = chartWeekIndices[wi];
      const parsed = parseWeekParts(w);
      const abs    = {};
      let total    = 0;
      vendorsSorted.forEach(v => {
        const val   = v.allByWeek[idx] ?? 0;
        abs[v.name] = val;
        total      += val;
      });
      return { parsed, abs, total };
    }),
  [chartWeeks, chartWeekIndices, vendorsSorted]);

  function makeRow(abs, total, labelStr, tooltipStr) {
    const myVal = abs[myVendor] ?? 0;
    return {
      label:    labelStr,
      tooltip:  tooltipStr,
      _total:   Math.round(total),
      _myVal:   Math.round(myVal),
      ms:       total > 0 ? myVal / total * 100 : 0,
      _vendors: vendorsSorted
        .filter(v => v.name !== myVendor)
        .map(v => ({ name: v.name, val: Math.round(abs[v.name] ?? 0) }))
        .filter(v => v.val > 0)
        .sort((a, b) => b.val - a.val),
    };
  }

  // 1년 전체 raw 데이터 (축 범위 고정용)
  const weeklyRaw1Y = useMemo(() => {
    const weeks1Y = allWeeks.slice(-52);
    const indices1Y = weeks1Y.map(w => allWeeks.indexOf(w));
    return weeks1Y.map((w, wi) => {
      const idx    = indices1Y[wi];
      const parsed = parseWeekParts(w);
      const abs    = {};
      let total    = 0;
      vendorsSorted.forEach(v => {
        const val   = v.allByWeek[idx] ?? 0;
        abs[v.name] = val;
        total      += val;
      });
      return { parsed, abs, total };
    });
  }, [allWeeks, vendorsSorted]);

  const chartData = useMemo(() => {
    if (period === '3M') {
      return weeklyRaw.map(d =>
        makeRow(d.abs, d.total, d.parsed.satLabel ?? '', d.parsed.satLabel ?? '')
      );
    }
    const monthMap = new Map();
    weeklyRaw.forEach(d => {
      const { year, month } = d.parsed;
      if (year == null) return;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, { year, month, abs: {}, total: 0 });
      const e = monthMap.get(key);
      e.total += d.total;
      Object.entries(d.abs).forEach(([k, v]) => { e.abs[k] = (e.abs[k] ?? 0) + v; });
    });
    const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([, e], i) => {
      const prevYear  = i > 0 ? sorted[i - 1][1].year : null;
      const isNewYear = !prevYear || prevYear !== e.year;
      const labelStr  = isNewYear ? `${String(e.year).slice(2)}.${e.month}` : String(e.month);
      return makeRow(e.abs, e.total, labelStr, `${e.year}년 ${e.month}월`);
    });
  }, [weeklyRaw, period, myVendor]);

  const { msDomain, msInterval } = useMemo(() => {
    const msValues = chartData.map(d => d.ms).filter(v => v > 0);
    if (msValues.length === 0) return { msDomain: [0, 100], msInterval: 20 };
    const minMs = Math.min(...msValues);
    const maxMs = Math.max(...msValues);
    const range   = Math.max(maxMs - minMs, 5);
    const padding = Math.max(5, range * 0.2);
    const step    = range + padding * 2 <= 10 ? 2
                  : range + padding * 2 <= 20 ? 5
                  : range + padding * 2 <= 40 ? 10 : 20;
    const lo = Math.max(0,   Math.floor((minMs - padding) / step) * step);
    const hi = Math.min(100, Math.ceil ((maxMs + padding) / step) * step);
    return { msDomain: [lo, hi], msInterval: step };
  }, [chartData]);

  const { yLeftMax, yLeftInterval } = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => d._total), 1);
    const mag    = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const step   = mag * (maxVal / mag <= 2 ? 0.5 : maxVal / mag <= 5 ? 1 : 2);
    const max    = Math.ceil(maxVal / step) * step;
    return { yLeftMax: max, yLeftInterval: max / 4 };
  }, [chartData]);

  const summary = useMemo(() => {
    const half  = Math.floor(weeklyRaw.length / 2);
    const sumV  = (arr, key) => arr.reduce((s, d) => s + (d.abs[key] ?? 0), 0);
    const sumT  = (arr) => arr.reduce((s, d) => s + d.total, 0);
    const curr  = weeklyRaw.slice(half);
    const prev  = weeklyRaw.slice(0, half);
    const totalMy  = Math.round(sumV(weeklyRaw, myVendor));
    const totalMkt = Math.round(sumT(weeklyRaw));
    const gr       = (c, p) => p > 0 ? (c - p) / p * 100 : null;
    const msOf     = (arr) => { const t = sumT(arr); return t > 0 ? sumV(arr, myVendor) / t * 100 : 0; };
    return {
      totalMy, totalMkt,
      msAvg:     totalMkt > 0 ? sumV(weeklyRaw, myVendor) / sumT(weeklyRaw) * 100 : 0,
      msChgPp:   msOf(curr) - msOf(prev),
      growthMkt: gr(sumT(curr), sumT(prev)),
    };
  }, [weeklyRaw, myVendor]);

  const option = useMemo(() => ({
    animation: false,
    grid: {
      left: 50,
      right: 34,
      top: 10,
      bottom: 24,
    },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TEXT_3, fontSize: 11, fontFamily: FONT_SANS },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: yLeftMax,
        interval: yLeftInterval,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: fmtAxis,
          color: TEXT_3,
          fontSize: 11,
          fontFamily: FONT_SANS,
        },
        splitLine: {
          show: true,
          lineStyle: { type: 'dashed', color: 'rgba(148,163,184,0.5)', width: 1 },
        },
      },
      {
        type: 'value',
        min: msDomain[0],
        max: msDomain[1],
        interval: msInterval,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: v => `${Math.round(v)}%`,
          color: MS_COLOR,
          fontSize: 11,
          fontFamily: FONT_SANS,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '전체시장',
        type: 'bar',
        data: chartData.map(d => d._total),
        barCategoryGap: '45%',
        barMaxWidth: 24,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#93c5fd' },
              { offset: 1, color: '#60a5fa' },
            ],
          },
          borderRadius: [3, 3, 0, 0],
          shadowBlur: 6,
          shadowColor: 'rgba(96, 165, 250, 0.35)',
          shadowOffsetY: 2,
        },
        z: 1,
      },
      {
        name: 'MS',
        type: 'line',
        yAxisIndex: 1,
        data: chartData.map(d => d.ms),
        lineStyle: { color: MS_COLOR, width: 2 },
        itemStyle: { color: MS_COLOR },
        showSymbol: false,
        emphasis: { showSymbol: true, symbolSize: 8 },
        z: 3,
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      padding: 0,
      formatter: (params) => {
        const idx = params[0]?.dataIndex ?? 0;
        const row = chartData[idx];
        if (!row) return '';
        const total = row._total ?? 0;
        const myVal = row._myVal ?? 0;
        const ms    = row.ms ?? 0;

        const topVendors = (row._vendors ?? []).slice(0, 3);
        let vendors = '';
        topVendors.forEach(v => {
          vendors += `<div style="display:flex;justify-content:space-between;gap:12px;color:${TEXT_SECONDARY};font-size:13px">
            <span>${v.name}</span><span>${fmtCompact(v.val)}</span></div>`;
        });

        return `<div style="background:${SURFACE};border-radius:6px;padding:8px 12px;font-size:13px;color:${TEXT_PRIMARY};min-width:160px;font-family:${FONT_SANS};box-shadow:0 4px 16px rgba(15,31,61,0.15);border:1px solid ${BORDER}">
          <div style="color:${TEXT_SECONDARY};font-weight:600;margin-bottom:5px;font-size:12px">${row.tooltip ?? row.label}</div>
          <div style="display:flex;justify-content:space-between;gap:12px;color:${MS_COLOR};font-weight:700;margin-bottom:3px">
            <span>${myVendor}</span><span>${fmtCompact(myVal)}</span></div>
          ${vendors}
          <div style="border-top:1px solid ${BORDER};margin-top:5px;padding-top:5px;display:flex;justify-content:space-between;color:${TEXT_SECONDARY}">
            <span>전체</span><span>${fmtCompact(total)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:12px;color:${MS_COLOR};font-weight:700;margin-top:3px">
            <span>MS</span><span>${ms.toFixed(1)}%</span></div>
        </div>`;
      },
    },
  }), [chartData, msDomain, msInterval, myVendor]);

  return (
    <div className="ag-card">

      {/* 헤더 */}
      <div className="ag-card__header">
        <div>
          <div className="ag-card__title">{metricLabel} 트렌드</div>
          <div className="ag-card__sub">전체시장 대비 {myVendor} MS 트렌드</div>
        </div>
        <div className="ag-card__header-right">
          <div className="ag-chart-legend">
            <div className="ag-chart-legend__item">
              <svg width="16" height="12">
                <rect x="0" y="2" width="16" height="8" fill={MARKET_COLOR} rx="2" />
              </svg>
              <span>전체시장</span>
            </div>
            <div className="ag-chart-legend__item">
              <svg width="24" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke={MS_COLOR} strokeWidth="2" />
              </svg>
              <span>MS%</span>
            </div>
          </div>
          <div className="ag-period-tabs">
            {CHART_PERIODS.map(p => (
              <div key={p.value}
                className={`ag-period-tab ${period === p.value ? 'active' : ''}`}
                onClick={() => setPeriod(p.value)}
              >{p.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 요약 위젯 */}
      <div className="ag-trend-summary">
        <div className="ag-trend-summary__group">
          <div className="ag-trend-summary__label">전체시장</div>
          <div className="ag-trend-summary__value-row">
            <span className="ag-trend-summary__number"
              title={summary.totalMkt.toLocaleString()}>
              {fmtCompact(summary.totalMkt)}
            </span>
          </div>
        </div>

        <div className="ag-trend-summary__vdiv" />

        <div className="ag-trend-summary__group">
          <div className="ag-trend-summary__label-row">
            <span className="ag-trend-summary__label">{myVendor}</span>
          </div>
          <div className="ag-trend-summary__value-row">
            <span className="ag-trend-summary__number">
              {summary.msAvg.toFixed(1)}%
            </span>
            <span className={`ag-trend-summary__badge ${summary.msChgPp >= 0 ? 'up' : 'down'}`}>
              {summary.msChgPp >= 0 ? '▲' : '▼'} {Math.abs(summary.msChgPp).toFixed(1)}%p
            </span>
          </div>
        </div>
      </div>

      {/* 콤보 차트 */}
      <div className="ag-chart-wrap">
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge
        />
      </div>
    </div>
  );
}
