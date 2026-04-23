import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { detectAndParse } from '../utils/backDataParser';
import AdminLayout from '../components/AdminLayout';
import './Admin.css';
import './DataPreview.css';


const TABS = ['처방', '매출'];

/* 검수 완료된 품목만 업로드 허용 */
const WEEKLY_ALLOWED = new Set(['levo_tension', 'levo_saltan', 'sinectura', 'rupafin', 'anycof', 'eze_pita']);

function getPeriodStart() {
  const now = new Date();
  if (now.getDate() >= 5) {
    return new Date(now.getFullYear(), now.getMonth(), 5);
  }
  return new Date(now.getFullYear(), now.getMonth() - 1, 5);
}

function getStorageKey(drugId, tab) {
  return `ag_upload_${drugId}_${tab}`;
}

function formatDate(date) {
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function DrugRow({ drug, idx }) {
  const navigate = useNavigate();

  const [uploadedAtMap] = useState(() => {
    const map = {};
    for (const tab of TABS) {
      const v = localStorage.getItem(getStorageKey(drug.id, tab));
      map[tab] = v ? new Date(v) : null;
    }
    return map;
  });

  const periodStart = getPeriodStart();

  return (
    <tr className={`upload-row${idx % 2 === 1 ? ' ag-tr--zebra' : ''}`}>
      <td className="upload-td upload-td--name">
        <span className="upload-drug-name">{drug.name}</span>
      </td>
      <td className="upload-td upload-td--date">
        <span className="upload-date-value">
          {Object.values(uploadedAtMap).find(Boolean)
            ? formatDate(Object.values(uploadedAtMap).filter(Boolean).sort((a,b) => b-a)[0])
            : '-'}
        </span>
      </td>
      {TABS.map(tab => {
        const at = uploadedAtMap[tab];
        const active = at !== null && at >= periodStart;
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

function DrugTable({ drugs }) {
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
            <DrugRow key={drug.dbId} drug={drug} idx={idx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 애니코프 부분 업로드 여부 확인 */
function detectAnycofPartial(parsed) {
  if (parsed.type !== 'prescription') return null;
  const anycof = parsed.results?.find(r => r.drugId === 'anycof');
  if (!anycof) return null;
  const hasMarket     = anycof.rows.some(r => r.product && r.product !== '애니코프');
  const hasStandalone = anycof.rows.some(r => r.product === '애니코프');
  if (hasMarket && !hasStandalone) return 'standalone'; // 시장 파일 올라옴 → 단독 필요
  if (hasStandalone && !hasMarket) return 'market';     // 단독 파일 올라옴 → 시장 필요
  return null;
}

/* 애니코프 두 파일 병합 + 검증 */
function mergeAnycof(firstParsed, secondParsed) {
  const firstRows  = firstParsed.results.find(r => r.drugId === 'anycof')?.rows ?? [];
  const secondRows = secondParsed.results.find(r => r.drugId === 'anycof')?.rows ?? [];

  if (secondRows.length === 0) throw new Error('두 번째 파일에서 애니코프 데이터를 찾을 수 없습니다.');

  const merged = [...firstRows, ...secondRows];

  const hasMarket     = merged.some(r => r.product && r.product !== '애니코프');
  const hasStandalone = merged.some(r => r.product === '애니코프');
  if (!hasMarket)     throw new Error('애니코프 시장 파일을 찾을 수 없습니다.');
  if (!hasStandalone) throw new Error('애니코프 단독 데이터 파일을 찾을 수 없습니다.');

  const latestMarket     = merged.filter(r => r.product && r.product !== '애니코프').map(r => r.week_id).sort().at(-1);
  const latestStandalone = merged.filter(r => r.product === '애니코프').map(r => r.week_id).sort().at(-1);
  if (latestMarket !== latestStandalone) {
    throw new Error(`두 파일의 최신 주차가 다릅니다. (시장: ${latestMarket}, 단독: ${latestStandalone})`);
  }

  return {
    type: firstParsed.type,
    results: [
      { drugId: 'anycof', rows: merged },
      ...firstParsed.results.filter(r => r.drugId !== 'anycof'),
      ...secondParsed.results.filter(r => r.drugId !== 'anycof'),
    ],
    skipped: [...(firstParsed.skipped ?? []), ...(secondParsed.skipped ?? [])],
  };
}


export default function Admin() {
  const navigate     = useNavigate();
  const importRef    = React.useRef(null);
  const secondRef    = React.useRef(null);

  const [importing,     setImporting]     = useState(false);
  const [importErr,     setImportErr]     = useState('');
  const [dragging,      setDragging]      = useState(false);
  const [pendingAnycof, setPendingAnycof] = useState(null);
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

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    processFirstFile(file);
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
          <span className="admin-toolbar-label">8대품목</span>
        </div>
        <div className="admin-toolbar-btns">
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="admin-action-btn admin-action-btn--secondary admin-action-btn--lg"
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 9V1M4 4l3-3 3 3M2 10v1.5A1.5 1.5 0 0 0 3.5 13h7A1.5 1.5 0 0 0 12 11.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Import
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
        <DrugTable drugs={DRUGS} />
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
    </AdminLayout>
  );
}
