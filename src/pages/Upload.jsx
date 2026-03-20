import React, { useState, useRef, useCallback } from 'react';
import { DRUGS } from '../config/drugs';
import { parseRawFile } from '../utils/rawParser';
import DrugDashboard from './DrugDashboard';
import './Upload.css';

export default function Upload() {
  const inputRef = useRef(null);

  const [selectedDrug, setSelectedDrug] = useState(DRUGS[0]);
  const [dragOver, setDragOver]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [result, setResult]             = useState(null);

  /* ─── 파일 처리 ─── */
  const handleFile = useCallback(async (file) => {
    setError('');
    setResult(null);

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('xlsx 또는 xls 파일만 지원합니다.');
      return;
    }

    setLoading(true);
    try {
      const parsed = await parseRawFile(file, selectedDrug);
      setResult(parsed);
    } catch (e) {
      setError(e.message || '파일 파싱 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedDrug]);

  /* ─── Drag & Drop ─── */
  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };
  const handleInput = (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const handleReset = () => {
    setResult(null);
    setError('');
  };

  /* ─── 대시보드 렌더 ─── */
  if (result) {
    return <DrugDashboard result={result} onReset={handleReset} />;
  }

  /* ─── 업로드 화면 ─── */
  return (
    <div className="upload-page">
      <header className="upload-header">
        <div className="upload-header__logo">
          <span className="upload-header__logo-mark">AG</span>
          <span className="upload-header__logo-name">board</span>
        </div>
        <span className="upload-header__version text-mono text-muted">v1.0</span>
      </header>

      <main className="upload-main">
        <div className="upload-hero">
          <p className="upload-hero__eyebrow text-mono">WEEKLY DATA IMPORT</p>
          <h1 className="upload-hero__title">
            로우파일 업로드하면<br />
            <span className="text-accent">M/S 대시보드 완성</span>
          </h1>
          <p className="upload-hero__desc">
            UBIST D1 Weekly 로우파일 (.xlsx)을 업로드하세요.
          </p>
        </div>

        {/* 약 선택 */}
        <div className="upload-drug-select">
          <p className="upload-drug-select__label text-mono">분석할 약 선택</p>
          <div className="upload-drug-select__pills">
            {DRUGS.map(drug => (
              <button
                key={drug.id}
                className={`drug-pill ${selectedDrug.id === drug.id ? 'active' : ''}`}
                onClick={() => { setSelectedDrug(drug); setError(''); }}
              >
                {drug.name}
              </button>
            ))}
          </div>
        </div>

        {/* 드롭존 */}
        <div
          className={`upload-zone ${dragOver ? 'upload-zone--active' : ''} ${error ? 'upload-zone--error' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleInput}
            style={{ display: 'none' }}
          />

          {loading ? (
            <div className="upload-zone__loading">
              <span className="upload-zone__spinner" />
              <p><strong>{selectedDrug.name}</strong> 데이터 분석 중...</p>
            </div>
          ) : (
            <>
              <div className="upload-zone__icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="8" y="4" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M22 4v8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M20 22v10M16 28l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="upload-zone__label">
                <strong>{selectedDrug.name}</strong> 로우파일 드래그 or 클릭
              </p>
              <p className="upload-zone__hint text-muted">.xlsx · .xls · D1 Weekly 형식</p>
            </>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="upload-error">
            <span>⚠</span> {error}
          </div>
        )}

        {/* 안내 */}
        <div className="upload-info">
          <p>지원 형식: <strong>UBIST D1 Weekly 로우파일</strong></p>
          <p>필수 컬럼: 성분, 판매사, 주차별 처방건수/처방량</p>
        </div>
      </main>
    </div>
  );
}
