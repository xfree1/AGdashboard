import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import './ChartSection.css';

/* ── Custom Tooltip ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="chart-tooltip__item" style={{ color: entry.color }}>
          {entry.name}: <strong>{entry.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * ChartSection
 * @param {Array} data         - Recharts 형식 데이터 배열
 * @param {string} type        - 'line' | 'bar'
 * @param {Array} lines        - [{ key, color, name }] - 표시할 데이터 키 목록
 * @param {string} xKey        - X축 키 이름
 * @param {string} [title]     - 차트 제목
 * @param {boolean} [loading]  - 로딩 상태
 */
export default function ChartSection({
  data = [],
  type = 'line',
  lines = [],
  xKey = 'date',
  title,
  loading = false,
}) {
  const COLORS = ['#00e5a0', '#4d7cfe', '#f5a623', '#ff4d6a', '#a78bfa'];

  const resolvedLines = useMemo(() => {
    if (lines.length > 0) return lines;
    // lines 미지정 시 xKey 제외한 모든 키 자동 사용
    if (data.length === 0) return [];
    return Object.keys(data[0])
      .filter(k => k !== xKey)
      .map((key, i) => ({ key, name: key, color: COLORS[i % COLORS.length] }));
  }, [lines, data, xKey]);

  return (
    <div className="chart-section">
      {title && (
        <div className="chart-section__header">
          <p className="chart-section__title">{title}</p>
        </div>
      )}

      <div className="chart-section__body">
        {loading ? (
          <div className="chart-section__loading">
            <span className="upload-zone__spinner" />
          </div>
        ) : data.length === 0 ? (
          <div className="chart-section__empty">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            {type === 'bar' ? (
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: '#4e5668', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#4e5668', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip content={<CustomTooltip />} />
                {resolvedLines.length > 1 && (
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#8892a4' }}
                  />
                )}
                {resolvedLines.map(({ key, color, name }) => (
                  <Bar key={key} dataKey={key} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: '#4e5668', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#4e5668', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip content={<CustomTooltip />} />
                {resolvedLines.length > 1 && (
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#8892a4' }}
                  />
                )}
                {resolvedLines.map(({ key, color, name }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={name}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: color }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
