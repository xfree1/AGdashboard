import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { detectAndParse } from '../utils/backDataParser';
import AdminLayout from '../components/AdminLayout';
import './DataPreview.css';


const TABS = ['처방', '매출'];

/** 매월 5일 기준: 현재 기간의 시작일 반환 */
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

function DrugRow({ drug }) {
  const navigate = useNavigate();

  // localStorage에서 탭별 업로드 날짜 초기화
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
    <tr className="upload-row">
      {/* 품목명 */}
      <td className="upload-td upload-td--name">
        <span className="upload-drug-name">{drug.name}</span>
      </td>

      {/* 최신 업로드날짜 */}
      <td className="upload-td upload-td--date">
        <span className="upload-date-value">
          {Object.values(uploadedAtMap).find(Boolean)
            ? formatDate(Object.values(uploadedAtMap).filter(Boolean).sort((a,b) => b-a)[0])
            : '-'}
        </span>
      </td>

      {/* 탭별 dot 컬럼 */}
      {TABS.map(tab => {
        const at = uploadedAtMap[tab];
        const active = at !== null && at >= periodStart;
        return (
          <td key={tab} className="upload-td upload-td--tab">
            <span className={`upload-status-dot${active ? ' upload-status-dot--on' : ''}`} />
          </td>
        );
      })}

      {/* 수정 */}
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
      <table className="upload-table">
        <thead>
          <tr>
            <th className="upload-th upload-th--name">품목명</th>
            <th className="upload-th upload-th--date">최신 업로드날짜</th>
            {TABS.map(tab => (
              <th key={tab} className="upload-th upload-th--tab">{tab}</th>
            ))}
            <th className="upload-th upload-th--edit">수정</th>
          </tr>
        </thead>
        <tbody>
          {drugs.map(drug => (
            <DrugRow key={drug.dbId} drug={drug} />
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default function Admin() {
  const navigate  = useNavigate();
  const importRef = React.useRef(null);

  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState('');
  const [importErr,  setImportErr]  = useState('');
  const [dragging,   setDragging]   = useState(false);


  /* ── Drag & Drop ── */
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processImportFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  /* ── Import ── */
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    processImportFile(file);
  };

  const processImportFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      setImportErr('xlsx 또는 xls 파일만 지원합니다.');
      return;
    }

    setImporting(true);
    setImportMsg('');
    setImportErr('');

    // React가 오버레이를 렌더할 수 있도록 한 프레임 양보
    await new Promise(resolve => setTimeout(resolve, 50));

    let parsed;
    try {
      parsed = await detectAndParse(file);
    } catch (err) {
      setImportErr(err.message);
      setImporting(false);
      return;
    }

    setImporting(false);
    // 업로드 전 미리보기 페이지로 이동 — 실제 저장은 UploadConfirm에서 수행
    navigate('/admin/upload-confirm', { state: { parsed, fileName: file.name } });
  };

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

  return (
    <AdminLayout heading={heading}>
      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <span className="admin-toolbar-label">8대품목</span>
        </div>

        <div className="admin-toolbar-btns">
          {/* Import */}
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
    </AdminLayout>
  );
}
