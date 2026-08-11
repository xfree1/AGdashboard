import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { detectAndParse } from '../utils/backDataParser';
import { loadAdminUploadDates, loadWeekIdsPerDrug } from '../utils/supabaseLoader';
import { fmtWeekDate, weekIdToSat, satToWeekId, weekIdToMonthWeekLabel } from '../utils/weekUtils';
import AdminLayout from '../components/AdminLayout';
import './Admin.css';
import './DataPreview.css';


const TABS = ['처방', '매출'];

function detectGaps(weekIds) {
  if (!weekIds || weekIds.length < 2) return [];
  const gaps = [];
  for (let i = 1; i < weekIds.length; i++) {
    const prevSat = weekIdToSat(weekIds[i - 1]);
    const currSat = weekIdToSat(weekIds[i]);
    if (!prevSat || !currSat) continue;
    const diffDays = (currSat - prevSat) / 86_400_000;
    const missing  = Math.round(diffDays / 7) - 1;
    if (missing > 0) gaps.push({ from: weekIds[i - 1], to: weekIds[i], missingCount: missing });
  }
  return gaps;
}

/* 전 품목 위클리 데이터 정합성 확인 — DB에 이미 저장된 주차 사이의 빈틈을 "N월 N주차" 라벨로 나열 */
function computeIntegrityReport(weekIdData, drugs) {
  const report = [];
  for (const drug of drugs) {
    const weekIds = weekIdData[drug.id] ?? [];
    if (weekIds.length === 0) {
      report.push({ drugId: drug.id, drugName: drug.name, empty: true, missing: [] });
      continue;
    }
    const missing = [];
    for (let i = 1; i < weekIds.length; i++) {
      const prevSat = weekIdToSat(weekIds[i - 1]);
      const currSat = weekIdToSat(weekIds[i]);
      if (!prevSat || !currSat) continue;
      const diffWeeks = Math.round((currSat - prevSat) / (7 * 86_400_000));
      for (let w = 1; w < diffWeeks; w++) {
        const missingSat = new Date(prevSat);
        missingSat.setDate(missingSat.getDate() + w * 7);
        const missingWeekId = satToWeekId(missingSat);
        missing.push({ weekId: missingWeekId, label: weekIdToMonthWeekLabel(missingWeekId) });
      }
    }
    if (missing.length > 0) {
      report.push({ drugId: drug.id, drugName: drug.name, empty: false, missing });
    }
  }
  return report;
}

/* 검수 완료된 품목만 업로드 허용 */
const WEEKLY_ALLOWED = new Set(['levotension', 'levosartan', 'levosartan_plus', 'synatura', 'rupafin', 'anycough', 'pevarozet', 'pevarozet_low', 'forlax', 'letopra', 'letopra_npcab']);

function getPeriodStart() {
  const now = new Date();
  if (now.getDate() >= 5) {
    return new Date(now.getFullYear(), now.getMonth(), 5);
  }
  return new Date(now.getFullYear(), now.getMonth() - 1, 5);
}

function formatMonthId(monthId) {
  // "2026-04" → "26.04"
  if (!monthId) return null;
  const [year, month] = monthId.split('-');
  return `${String(year).slice(2)}.${month}`;
}

function DrugRow({ drug, dates, weekIds }) {
  const navigate = useNavigate();
  const periodStart = getPeriodStart();

  const rxSat   = dates?.weekId  ? weekIdToSat(dates.weekId)       : null;
  const salesDt = dates?.monthId ? new Date(dates.monthId + '-01') : null;

  const rxActive    = rxSat   !== null && rxSat   >= periodStart;
  const salesActive = salesDt !== null && salesDt >= periodStart;

  let displayDate = null;
  if (rxSat && salesDt) {
    displayDate = rxSat >= salesDt ? fmtWeekDate(dates.weekId) : formatMonthId(dates.monthId);
  } else if (rxSat) {
    displayDate = fmtWeekDate(dates.weekId);
  } else if (salesDt) {
    displayDate = formatMonthId(dates.monthId);
  }

  const gaps         = useMemo(() => detectGaps(weekIds), [weekIds]);
  const totalMissing = useMemo(() => gaps.reduce((s, g) => s + g.missingCount, 0), [gaps]);
  const gapTitle     = useMemo(() => gaps.map(g => `${fmtWeekDate(g.from)} → ${fmtWeekDate(g.to)}: ${g.missingCount}주 누락`).join('\n'), [gaps]);

  return (
    <tr className="upload-row">
      <td className="upload-td upload-td--name">
        {weekIds === null && (
          <span className="upload-gap-badge upload-gap-badge--loading">…</span>
        )}
        {totalMissing > 0 && (
          <span className="upload-gap-badge" title={gapTitle}>
            ⚠ {totalMissing}주 누락
          </span>
        )}
        <span className="upload-drug-name">{drug.name}</span>
      </td>
      <td className="upload-td upload-td--date">
        <span className="upload-date-value">
          {displayDate ?? '-'}
        </span>
      </td>
      {TABS.map(tab => {
        const active = tab === '처방' ? rxActive : salesActive;
        return (
          <td key={tab} className="upload-td upload-td--tab">
            <span className={`upload-status-dot${active ? ' upload-status-dot--on' : ''}`} />
          </td>
        );
      })}
      <td className="upload-td upload-td--form">
        {drug.excludeDosage?.length > 0
          ? <span className="upload-form-tag">{drug.excludeDosage.join(' ')} 제외</span>
          : <span className="upload-form-tag upload-form-tag--all">전체</span>
        }
      </td>
      <td className="upload-td upload-td--edit">
        <button
          className="upload-icon-btn upload-icon-btn--dots"
          title="데이터 확인"
          onClick={() => navigate(`/admin/preview/${drug.id}`)}
        >
          ···
        </button>
      </td>
    </tr>
  );
}

function DrugTable({ drugs, uploadDates, weekIdData }) {
  return (
    <div className="upload-table-wrap">
      <table className="upload-table ag-table">
        <thead>
          <tr>
            <th className="upload-th upload-th--name">품목명</th>
            <th className="upload-th upload-th--date">최신 업로드날짜</th>
            {TABS.map(tab => (
              <th key={tab} className="upload-th upload-th--tab">{tab}</th>
            ))}
            <th className="upload-th upload-th--form">제형 필터</th>
            <th className="upload-th upload-th--edit">수정</th>
          </tr>
        </thead>
        <tbody>
          {drugs.map((drug, idx) => (
            <DrugRow
              key={drug.id}
              drug={drug}
              dates={uploadDates[drug.id] ?? null}
              weekIds={weekIdData ? (weekIdData[drug.id] ?? []) : null}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 애니코프 부분 업로드 여부 확인 */
function detectAnycofPartial(parsed) {
  if (parsed.type !== 'prescription') return null;
  const anycof = parsed.results?.find(r => r.drugId === 'anycough');
  if (!anycof) return null;
  const hasMarket     = anycof.rows.some(r => r.product && r.product !== '애니코프');
  const hasStandalone = anycof.rows.some(r => r.product === '애니코프');
  if (hasMarket && !hasStandalone) return 'standalone'; // 시장 파일 올라옴 → 단독 필요
  if (hasStandalone && !hasMarket) return 'market';     // 단독 파일 올라옴 → 시장 필요
  return null;
}

/* 애니코프 두 파일 병합 + 검증 */
function mergeAnycof(firstParsed, secondParsed) {
  const firstRows  = firstParsed.results.find(r => r.drugId === 'anycough')?.rows ?? [];
  const secondRows = secondParsed.results.find(r => r.drugId === 'anycough')?.rows ?? [];

  if (secondRows.length === 0) throw new Error('두 번째 파일에서 애니코프 데이터를 찾을 수 없습니다.');

  const merged = [...firstRows, ...secondRows];

  const hasMarket     = merged.some(r => r.product && r.product !== '애니코프');
  const hasStandalone = merged.some(r => r.product === '애니코프');
  if (!hasMarket)     throw new Error('애니코프 시장 파일을 찾을 수 없습니다.');
  if (!hasStandalone) throw new Error('애니코프 단독 데이터 파일을 찾을 수 없습니다.');

  // 두 파일의 공통 주차(교집합)만 사용 — 한 쪽이 더 긴 기간이어도 누락 셀 방지
  const marketWeeks     = new Set(merged.filter(r => r.product && r.product !== '애니코프').map(r => r.week_id));
  const standaloneWeeks = new Set(merged.filter(r => r.product === '애니코프').map(r => r.week_id));
  const commonWeeks     = new Set([...marketWeeks].filter(w => standaloneWeeks.has(w)));
  if (commonWeeks.size === 0) throw new Error('두 파일의 공통 주차가 없습니다. 기간을 확인해주세요.');
  const trimmed = merged.filter(r => commonWeeks.has(r.week_id));

  return {
    type: firstParsed.type,
    results: [
      { drugId: 'anycough', rows: trimmed },
      ...firstParsed.results.filter(r => r.drugId !== 'anycough'),
      ...secondParsed.results.filter(r => r.drugId !== 'anycough'),
    ],
    skipped: [...(firstParsed.skipped ?? []), ...(secondParsed.skipped ?? [])],
  };
}


export default function Admin() {
  const navigate     = useNavigate();
  const secondRef    = React.useRef(null);

  const [uploadDates,   setUploadDates]   = useState({});
  const [weekIdData,    setWeekIdData]    = useState(null);
  const [importing,     setImporting]     = useState(false);
  const [importErr,     setImportErr]     = useState('');
  const [dragging,      setDragging]      = useState(false);
  const [pendingAnycof, setPendingAnycof] = useState(null);
  const [checking,      setChecking]      = useState(false);
  const [checkResult,   setCheckResult]   = useState(null); // null = 모달 닫힘, [] | [...] = 모달 열림

  useEffect(() => {
    loadAdminUploadDates(DRUGS).then(setUploadDates).catch(() => {});
    loadWeekIdsPerDrug(DRUGS).then(setWeekIdData).catch(() => setWeekIdData({}));
  }, []);
  // pendingAnycof = { parsed, neededType: 'market'|'standalone', firstFileName }

  /* ── 공통 파일 파싱 ── */
  const parseFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) throw new Error('xlsx 또는 xls 파일만 지원합니다.');
    return detectAndParse(file);
  };

  /* ── 첫 번째 파일 처리 ── */
  const processFirstFile = async (file) => {
    setImporting(true);
    setImportErr('');
    await new Promise(resolve => setTimeout(resolve, 50));

    let parsed;
    try {
      parsed = await parseFile(file);
    } catch (err) {
      setImportErr(err.message);
      setImporting(false);
      return;
    }

    setImporting(false);

    // 처방 파일 — 미검수 품목 차단
    if (parsed.type === 'prescription') {
      const blocked = parsed.results
        .map(r => r.drugId)
        .filter(id => !WEEKLY_ALLOWED.has(id));
      if (blocked.length > 0) {
        const names = blocked.join(', ');
        setImportErr(`아직 검수되지 않은 품목이 포함되어 있어 업로드할 수 없습니다: ${names}`);
        return;
      }
    }

    // 애니코프 부분 업로드 감지
    const neededType = detectAnycofPartial(parsed);
    if (neededType) {
      setPendingAnycof({ parsed, neededType, firstFileName: file.name });
      return;
    }

    navigate('/admin/upload-confirm', { state: { parsed, fileName: file.name } });
  };

  /* ── 두 번째 파일 처리 (애니코프 전용) ── */
  const processSecondFile = async (file) => {
    setImporting(true);
    setImportErr('');
    await new Promise(resolve => setTimeout(resolve, 50));

    let secondParsed;
    try {
      secondParsed = await parseFile(file);
    } catch (err) {
      setImportErr(err.message);
      setImporting(false);
      return;
    }

    let mergedParsed;
    try {
      mergedParsed = mergeAnycof(pendingAnycof.parsed, secondParsed);
    } catch (err) {
      setImportErr(err.message);
      setImporting(false);
      return;
    }

    // 병합 후에도 미검수 품목 차단
    const blocked = mergedParsed.results
      .map(r => r.drugId)
      .filter(id => !WEEKLY_ALLOWED.has(id));
    if (blocked.length > 0) {
      setImportErr(`아직 검수되지 않은 품목이 포함되어 있어 업로드할 수 없습니다: ${blocked.join(', ')}`);
      setImporting(false);
      return;
    }

    setImporting(false);
    setPendingAnycof(null);
    navigate('/admin/upload-confirm', {
      state: { parsed: mergedParsed, fileName: `${pendingAnycof.firstFileName}, ${file.name}` },
    });
  };

  /* ── 이벤트 핸들러 ── */
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFirstFile(file);
  };

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  /* ── 위클리 데이터 정합성 확인 (읽기 전용) ── */
  const handleCheckIntegrity = async () => {
    setChecking(true);
    setImportErr('');
    try {
      const freshWeekIdData = await loadWeekIdsPerDrug(DRUGS);
      setWeekIdData(freshWeekIdData);
      setCheckResult(computeIntegrityReport(freshWeekIdData, DRUGS));
    } catch (err) {
      setImportErr('정합성 확인 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleSecondFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processSecondFile(file);
  };

  const handleSecondFileInput = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    processSecondFile(file);
  };

  /* ── heading ── */
  const heading = (
    <div className="admin-heading-row">
      <div className="preview-heading">
        <nav className="preview-breadcrumb">
          <span className="preview-bc-current">관리자 페이지</span>
        </nav>
        <h1 className="preview-page-title preview-page-title--static">관리자 페이지</h1>
      </div>
    </div>
  );

  const neededLabel = pendingAnycof?.neededType === 'standalone' ? '단독 데이터' : '시장';

  return (
    <AdminLayout heading={heading}>
      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <span className="admin-toolbar-label">안국약품</span>
        </div>
        <div className="admin-toolbar-btns">
          <button
            className="admin-action-btn admin-action-btn--secondary admin-action-btn--lg"
            onClick={handleCheckIntegrity}
            disabled={checking || weekIdData === null}
          >
            {checking ? (
              <span className="upload-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            데이터 확인
          </button>
        </div>
      </div>

      {importErr && (
        <div className="admin-error admin-error--mb">
          {importErr}
          <button className="admin-error__close" onClick={() => setImportErr('')}>✕</button>
        </div>
      )}

      <div
        className={`upload-single${dragging ? ' upload-single--dragging' : ''}${importing ? ' upload-single--importing' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {dragging && (
          <div className="upload-drag-overlay">
            <div className="upload-drag-overlay__inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 16V8M9 11l3-3 3 3M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11A1.5 1.5 0 0 0 19 18.5V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>엑셀 파일을 드롭해주세요</span>
            </div>
          </div>
        )}
        {importing && (
          <div className="upload-drag-overlay">
            <div className="upload-drag-overlay__inner">
              <span className="upload-overlay-spinner" />
              <span>로딩중</span>
            </div>
          </div>
        )}
        <DrugTable drugs={DRUGS} uploadDates={uploadDates} weekIdData={weekIdData} />
      </div>

      {/* 애니코프 두 번째 파일 요청 모달 */}
      {pendingAnycof && (
        <div className="anycof-modal-backdrop">
          <div className="anycof-modal">
            <div className="anycof-modal__header">
              <span className="anycof-modal__title">애니코프 {neededLabel} 파일 필요</span>
              <button className="anycof-modal__close" onClick={() => { setPendingAnycof(null); setImportErr(''); }}>✕</button>
            </div>
            <p className="anycof-modal__desc">
              <strong>{pendingAnycof.firstFileName}</strong> 감지 완료.<br />
              애니코프 <strong>{neededLabel}</strong> 파일을 추가로 업로드해주세요.
            </p>

            <input
              ref={secondRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleSecondFileInput}
            />

            <div
              className={`anycof-modal__dropzone${importing ? ' anycof-modal__dropzone--loading' : ''}`}
              onDrop={handleSecondFileDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => secondRef.current?.click()}
            >
              {importing ? (
                <>
                  <span className="upload-overlay-spinner" />
                  <span>로딩중</span>
                </>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 16V8M9 11l3-3 3 3M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11A1.5 1.5 0 0 0 19 18.5V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>드래그하거나 클릭해서 업로드</span>
                </>
              )}
            </div>

            {importErr && (
              <div className="anycof-modal__err">{importErr}</div>
            )}
          </div>
        </div>
      )}

      {/* 위클리 데이터 정합성 확인 결과 모달 */}
      {checkResult !== null && (
        <div className="integrity-modal-backdrop" onClick={() => setCheckResult(null)}>
          <div className="integrity-modal" onClick={e => e.stopPropagation()}>
            <div className="integrity-modal__header">
              <span className="integrity-modal__title">위클리 데이터 정합성 확인</span>
              <button className="integrity-modal__close" onClick={() => setCheckResult(null)}>✕</button>
            </div>

            {checkResult.length === 0 ? (
              <div className="integrity-modal__success">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M17 5.5L7.5 15 3 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                모든 품목의 위클리 데이터가 안전하게 저장되어 있습니다.
              </div>
            ) : (
              <div className="integrity-modal__body">
                {checkResult.map(item => (
                  <div className="integrity-drug-block" key={item.drugId}>
                    <span className="integrity-drug-name">{item.drugName}</span>
                    {item.empty ? (
                      <span className="integrity-missing-tag integrity-missing-tag--empty">업로드된 데이터가 없습니다</span>
                    ) : (
                      <div className="integrity-missing-list">
                        {item.missing.map(m => (
                          <span className="integrity-missing-tag" key={m.weekId}>{m.label} 데이터 없음</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
