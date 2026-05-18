import React from 'react';
import MainLayout from '../components/MainLayout';
import './CsdPage.css';

export default function CsdPage() {
  return (
    <MainLayout>
      <div className="csd-wrap">

        {/* ── 바디: 회사 패널 + 메인 ── */}
        <div className="csd-body">

          {/* 회사 리스트 패널 */}
          <div className="csd-company-panel">
            <div className="csd-search-box">제약사 검색…</div>
            <div className="csd-company-list">
              {[
                '딸기제약','포도약품','수박케미칼','참외바이오','레몬파마',
                '망고약품','키위제약','블루베리','자두케미칼','바나나약품',
                '복숭아제약','파인애플약','코코넛바이오','두리안파마','구아바약',
              ].map((name, i) => (
                <div key={name} className={`csd-company-item${i === 9 ? ' csd-company-item--active' : ''}`}>
                  <span className="csd-company-rank">{i + 1}</span>
                  <span className="csd-company-name">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="csd-main">

            {/* 헤더바 */}
            <div className="csd-topbar">
              <div className="csd-topbar-left">
                <div className="csd-rank-badge">
                  <span className="csd-rank-num">999위</span>
                  <span className="csd-rank-total">/ 999</span>
                </div>
                <span className="csd-selected-company">바나나약품</span>
                <span className="csd-topbar-period">9999.99 – 9999.99</span>
              </div>
              <div className="csd-topbar-filters">
                <div className="csd-filter-group">
                  <button className="csd-filter-btn csd-filter-btn--active">전체</button>
                  <button className="csd-filter-btn">대면</button>
                  <button className="csd-filter-btn">디지털</button>
                </div>
                <div className="csd-filter-group">
                  <button className="csd-filter-btn csd-filter-btn--active">전체</button>
                  <button className="csd-filter-btn">병원</button>
                  <button className="csd-filter-btn">의원</button>
                </div>
              </div>
            </div>

            {/* ── 미드 그리드: 左 트렌드 차트 / 右 KPI + 진료과 ── */}
            <div className="csd-mid-grid">

              {/* 左: 트렌드 차트 */}
              <div className="csd-mid-left">
                <div className="ag-card csd-combined-card">
                  <div className="ag-card__header">
                    <div>
                      <div className="ag-card__title">월별 CALL 추이 &amp; SOV 트렌드</div>
                      <div className="ag-card__sub">전체 채널 · 전체 종별</div>
                    </div>
                    <div className="ag-card__header-right">
                      <span className="csd-legend-item csd-legend-item--call">— Call 수 (좌축)</span>
                      <span className="csd-legend-item csd-legend-item--sov">— SoV % (우축)</span>
                    </div>
                  </div>
                  <div className="csd-chart-ph csd-chart-ph--trend" />
                </div>
              </div>

              {/* 右: KPI 2×2 + 진료과별 Top 10 */}
              <div className="csd-mid-right">
                <div className="kpi-row">
                  <div className="kpi-card">
                    <div className="kpi-label">최근 월 CALL</div>
                    <div className="kpi-value">9,999</div>
                    <div className="csd-kpi-sub csd-kpi-sub--down">▼ 99.9% 전월 대비</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">최근 월 SOV</div>
                    <div className="kpi-value">99.99%</div>
                    <div className="csd-kpi-sub">전체 채널 · 전체 종별</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">3개월 평균 CALL</div>
                    <div className="kpi-value">9,888</div>
                    <div className="csd-kpi-sub">전체 채널 · 전체 종별</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">전체 순위</div>
                    <div className="kpi-value">999위</div>
                    <div className="csd-kpi-sub">Top999 · 전체 채널</div>
                  </div>
                </div>

                {/* 진료과별 Top 10 */}
                <div className="ag-card csd-specialty-card">
                  <div className="ag-card__header">
                    <div className="ag-card__title">진료과별 Top 10 (99.99)</div>
                  </div>
                  <div className="csd-chart-ph csd-chart-ph--specialty" />
                </div>
              </div>

            </div>

          </div>{/* /csd-main */}
        </div>{/* /csd-body */}

      </div>
    </MainLayout>
  );
}
