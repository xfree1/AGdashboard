import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { supabase } from '../lib/supabase';
import { fmtWeekLabel } from '../utils/weekUtils';
import { loadMonthlySales } from '../utils/supabaseLoader';
import { useUnderlineSlide } from '../hooks/useUnderlineSlide';
import AdminLayout from '../components/AdminLayout';
import './DataPreview.css';

const PAGE_SIZE = 1000;

async function fetchAllRows(dbId) {
  let allData = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('weekly_data')
      .select('drug_id, vendor, week_id, rx_value, qty_value')
      .order('week_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (dbId === 'retopra') {
      query = query.or('drug_id.eq.retopra_pcab,drug_id.eq.retopra_npcab');
    } else {
      query = query.eq('drug_id', dbId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

export default function DataPreview() {
  const { drugId } = useParams();
  const navigate = useNavigate();
  const drug = DRUGS.find(d => d.id === drugId);

  const metric = drug?.metric ?? 'qty';
  const [activeTab, setActiveTab] = useState('prescription');  // 'prescription' | 'sales'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weeks, setWeeks] = useState([]);
  const [vendorRows, setVendorRows] = useState([]);
  const [colEnd, setColEnd] = useState(0);
  const [visibleCount, setVisibleCount] = useState(15);
  const [salesRows, setSalesRows] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [salesColEnd, setSalesColEnd] = useState(0);
  const [drugDropOpen, setDrugDropOpen] = useState(false);
  const { triggered, fire } = useUnderlineSlide();

  const COLS_PER_PAGE = 8;
  const ROWS_PER_PAGE = 15;

  useEffect(() => {
    if (!drug) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const raw = await fetchAllRows(drug.dbId);

        if (cancelled) return;

        // vendor × week_id 집계
        const map = {};
        const weekSet = new Set();

        raw.forEach(row => {
          const vendor = (row.vendor || '').trim();
          const weekId = row.week_id;
          if (!vendor) return;
          weekSet.add(weekId);
          if (!map[vendor]) map[vendor] = {};
          if (!map[vendor][weekId]) map[vendor][weekId] = { rx: 0, qty: 0 };
          map[vendor][weekId].rx  += row.rx_value  ?? 0;
          map[vendor][weekId].qty += row.qty_value ?? 0;
        });

        const allWeeks = [...weekSet].sort();

        const rows = Object.entries(map)
          .map(([vendor, data]) => {
            const total = allWeeks.reduce((s, w) => s + (data[w]?.[metric] ?? 0), 0);
            return { vendor, data, total };
          })
          .sort((a, b) => {
            if (a.vendor === drug.myVendor) return -1;
            if (b.vendor === drug.myVendor) return 1;
            return b.total - a.total;
          })
          .map(({ vendor, data }) => ({ vendor, data }));

        setWeeks(allWeeks);
        setVendorRows(rows);
        setColEnd(allWeeks.length); // 가장 최근 8주가 끝에 오도록
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [drug?.dbId]);

  // 매출 탭 선택 시 로드
  useEffect(() => {
    if (activeTab !== 'sales' || !drug) return;
    setSalesLoading(true);
    setSalesError('');
    loadMonthlySales(drug.dbId)
      .then(data => { setSalesRows(data); setSalesColEnd(data.length); setSalesLoading(false); })
      .catch(e  => { setSalesError(e.message); setSalesLoading(false); });
  }, [activeTab, drug?.dbId]);

  if (!drug) {
    return <div className="preview-not-found">약품을 찾을 수 없습니다.</div>;
  }

  const fmt = v => Math.round(v ?? 0).toLocaleString();

  const startIdx = Math.max(0, colEnd - COLS_PER_PAGE);
  const visibleWeeks = weeks.slice(startIdx, colEnd);

  const heading = (
    <div className="preview-heading">
      <nav className="preview-breadcrumb">
        <button className="preview-bc-link" onClick={() => navigate('/admin')}>관리자페이지</button>
        <span className="preview-bc-sep">›</span>
        <span className="preview-bc-current">{drug.name} 처방 데이터</span>
      </nav>
      <div className="preview-title-wrap">
        <h1
          className={`preview-page-title anim-underline-slide${drugDropOpen ? ' --open' : ''}${triggered ? ' --triggered' : ''}`}
          onClick={() => { setDrugDropOpen(o => !o); fire(); }}
        >
          {drug.name} 처방 데이터
          <span className={`preview-title-arrow${drugDropOpen ? ' --open' : ''}`}>▾</span>
        </h1>
        {drugDropOpen && (
          <ul className="preview-drug-dropdown">
            {DRUGS.map(d => (
              <li
                key={d.id}
                className={`preview-drug-dropdown__item${d.id === drugId ? ' --active' : ''}`}
                onClick={() => { setDrugDropOpen(false); navigate(`/admin/preview/${d.id}`); }}
              >
                {d.id === drugId && <span className="preview-drug-dropdown__dot" />}
                {d.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout heading={heading}>
      {/* Tab Bar */}
      <div className="preview-tabbar">
        <div className="preview-tabs">
          <button
            className={`preview-tab${activeTab === 'prescription' ? ' preview-tab--active' : ''}`}
            onClick={() => setActiveTab('prescription')}
          >
            {drug.metric === 'rx' ? '처방건수' : '처방량'}
          </button>
          <button
            className={`preview-tab${activeTab === 'sales' ? ' preview-tab--active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            매출
          </button>
        </div>
        <div className="preview-tabbar-right">
          {activeTab === 'prescription' && (
            <div className="preview-col-nav">
              <button
                className="preview-col-btn"
                onClick={() => setColEnd(e => Math.max(COLS_PER_PAGE, e - COLS_PER_PAGE))}
                disabled={startIdx === 0 || loading}
              >← 이전</button>
              <button
                className="preview-col-btn"
                onClick={() => setColEnd(e => Math.min(weeks.length, e + COLS_PER_PAGE))}
                disabled={colEnd >= weeks.length || loading}
              >다음 →</button>
            </div>
          )}
          {activeTab === 'sales' && !salesLoading && !salesError && salesRows.length > 0 && (
            <div className="preview-col-nav">
              <button
                className="preview-col-btn"
                onClick={() => setSalesColEnd(e => Math.max(COLS_PER_PAGE, e - COLS_PER_PAGE))}
                disabled={salesColEnd <= COLS_PER_PAGE}
              >← 이전</button>
              <button
                className="preview-col-btn"
                onClick={() => setSalesColEnd(e => Math.min(salesRows.length, e + COLS_PER_PAGE))}
                disabled={salesColEnd >= salesRows.length}
              >다음 →</button>
            </div>
          )}
        </div>
      </div>

      {/* 매출 탭 콘텐츠 */}
      {activeTab === 'sales' && (
        <>
          {salesLoading && (
            <div className="admin-loading">
              <span className="admin-spinner" />
              <span>매출 데이터 불러오는 중...</span>
            </div>
          )}
          {salesError && <div className="admin-error">{salesError}</div>}
          {!salesLoading && !salesError && salesRows.length === 0 && (
            <div className="preview-empty">업로드된 매출 데이터가 없습니다.</div>
          )}
          {!salesLoading && !salesError && salesRows.length > 0 && (() => {
            const salesStartIdx = Math.max(0, salesColEnd - COLS_PER_PAGE);
            const visibleSales = salesRows.slice(salesStartIdx, salesColEnd);
            return (
              <div className="preview-table-wrap">
                <table className="preview-table preview-table--sales">
                  <thead>
                    <tr>
                      <th className="preview-th preview-th--sales-label">구분</th>
                      {visibleSales.map(({ month_id }) => (
                        <th key={month_id} className="preview-th preview-th--sales-month">{month_id}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="preview-row preview-row--mine">
                      <td className="preview-td preview-td--sales-label">처방조제액(원)</td>
                      {visibleSales.map(({ month_id, sales }) => (
                        <td key={month_id} className="preview-td preview-td--value">
                          {Math.round(sales ?? 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}

      {/* 처방 탭 콘텐츠 */}
      {activeTab === 'prescription' && loading && (
        <div className="admin-loading">
          <span className="admin-spinner" />
          <span>데이터 불러오는 중...</span>
        </div>
      )}

      {activeTab === 'prescription' && error && <div className="admin-error">{error}</div>}

      {activeTab === 'prescription' && !loading && !error && weeks.length === 0 && (
        <div className="preview-empty">업로드된 데이터가 없습니다.</div>
      )}

      {activeTab === 'prescription' && !loading && !error && weeks.length > 0 && (
        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead>
              <tr>
                <th className="preview-th preview-th--vendor">제조사</th>
                {visibleWeeks.map(w => (
                  <th key={w} className="preview-th preview-th--week">{fmtWeekLabel(w)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorRows.slice(0, visibleCount).map(({ vendor, data }) => (
                <tr
                  key={vendor}
                  className={`preview-row${vendor === drug.myVendor ? ' preview-row--mine' : ''}`}
                >
                  <td className="preview-td preview-td--vendor">{vendor}</td>
                  {visibleWeeks.map(w => {
                    const val = data[w]?.[metric] ?? 0;
                    return (
                      <td
                        key={w}
                        className={`preview-td preview-td--value${val === 0 ? ' preview-td--zero' : ''}`}
                      >
                        {fmt(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {vendorRows.length > ROWS_PER_PAGE && (
            <div className="preview-row-ctrl">
              {visibleCount < vendorRows.length ? (
                <button
                  className="preview-row-btn"
                  onClick={() => setVisibleCount(c => Math.min(vendorRows.length, c + ROWS_PER_PAGE))}
                >
                  더보기
                </button>
              ) : (
                <button
                  className="preview-row-btn"
                  onClick={() => setVisibleCount(ROWS_PER_PAGE)}
                >
                  접기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
