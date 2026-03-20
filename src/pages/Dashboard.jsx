import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KPICard from '../components/KPICard';
import ChartSection from '../components/ChartSection';
import TableSection from '../components/TableSection';
import './Dashboard.css';

/* ══════════════════════════════════════════════════════
   헬퍼: 엑셀 데이터 → KPI / Chart / Table 데이터로 변환
   ※ 실제 컬럼 구조에 맞게 이 섹션을 수정하세요.
══════════════════════════════════════════════════════ */

function processData(headers, rows) {
  // 숫자형 컬럼 자동 감지
  const numericCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => {
      const sample = rows.slice(0, 10).map(r => r[i]);
      const nums = sample.filter(v => v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v)));
      return nums.length >= sample.length * 0.6;
    });

  // 날짜형 컬럼 감지 (첫 번째로 발견되는 컬럼)
  const dateColIdx = headers.findIndex(h =>
    /날짜|일자|date|month|월|기간/i.test(h)
  );

  // KPI: 숫자 컬럼 합계
  const kpis = numericCols.slice(0, 4).map(({ h, i }) => {
    const values = rows.map(r => parseFloat(String(r[i] ?? '').replace(/,/g, '')) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const half = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, half).reduce((a, b) => a + b, 0);
    const secondHalf = values.slice(half).reduce((a, b) => a + b, 0);
    const change = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    return {
      label: h,
      value: total >= 100000000
        ? `${(total / 100000000).toFixed(1)}억`
        : total >= 10000
        ? `${(total / 10000).toFixed(0)}만`
        : total.toLocaleString(),
      change: parseFloat(change.toFixed(1)),
    };
  });

  // Chart 데이터: 날짜 or 첫 컬럼 기준
  const xColIdx = dateColIdx >= 0 ? dateColIdx : 0;
  const xKey = headers[xColIdx] || 'index';
  const chartLines = numericCols.filter(({ i }) => i !== xColIdx).slice(0, 3);
  const CHART_COLORS = ['#00e5a0', '#4d7cfe', '#f5a623'];

  const chartData = rows.slice(0, 60).map((row, ri) => {
    const obj = { [xKey]: row[xColIdx] ?? ri + 1 };
    chartLines.forEach(({ h, i }) => {
      obj[h] = parseFloat(String(row[i] ?? '0').replace(/,/g, '')) || 0;
    });
    return obj;
  });

  const resolvedLines = chartLines.map(({ h }, idx) => ({
    key: h, name: h, color: CHART_COLORS[idx],
  }));

  return { kpis, chartData, xKey, resolvedLines };
}

/* ══════════════════════════════════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('agboard_data');
    if (!raw) {
      navigate('/upload');
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      navigate('/upload');
    }
  }, [navigate]);

  const processed = useMemo(() => {
    if (!data) return null;
    return processData(data.headers, data.rows);
  }, [data]);

  const loading = !data || !processed;

  /* 포맷 헬퍼 */
  const uploadedAt = data
    ? new Date(data.uploadedAt).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo__mark">AG</span>
          <span className="sidebar-logo__name">board</span>
        </div>

        <nav className="sidebar-nav">
          <a className="sidebar-nav__item sidebar-nav__item--active" href="/dashboard">
            <span>대시보드</span>
          </a>
          <a className="sidebar-nav__item" href="/upload">
            <span>데이터 업로드</span>
          </a>
        </nav>

        {data && (
          <div className="sidebar-meta">
            <p className="sidebar-meta__file text-mono">{data.fileName}</p>
            <p className="sidebar-meta__time text-muted">{uploadedAt}</p>
            <p className="sidebar-meta__rows text-muted text-mono">
              {data.rows.length.toLocaleString()} rows
            </p>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="dashboard-main">
        {/* Top bar */}
        <header className="dashboard-topbar">
          <div>
            <h1 className="dashboard-topbar__title">대시보드</h1>
            {data && (
              <p className="dashboard-topbar__sub text-muted">
                {data.fileName} · {data.rows.length.toLocaleString()}행
              </p>
            )}
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => navigate('/upload')}
          >
            ↑ 새 파일 업로드
          </button>
        </header>

        {/* Content */}
        <div className="dashboard-content">
          {/* KPI Row */}
          <section className="dashboard-kpi-grid">
            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <KPICard key={i} label="—" value="—" loading />
                ))
              : processed.kpis.map((kpi, i) => (
                  <KPICard key={i} {...kpi} />
                ))
            }
          </section>

          {/* Chart */}
          <section className="dashboard-charts-grid">
            <ChartSection
              title="추이 (라인)"
              type="line"
              data={loading ? [] : processed.chartData}
              lines={loading ? [] : processed.resolvedLines}
              xKey={loading ? 'x' : processed.xKey}
              loading={loading}
            />
            <ChartSection
              title="합계 (바)"
              type="bar"
              data={loading ? [] : processed.chartData}
              lines={loading ? [] : processed.resolvedLines}
              xKey={loading ? 'x' : processed.xKey}
              loading={loading}
            />
          </section>

          {/* Table */}
          <section>
            <TableSection
              title="전체 데이터"
              headers={loading ? [] : data.headers}
              rows={loading ? [] : data.rows}
              loading={loading}
              pageSize={20}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
