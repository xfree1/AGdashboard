import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { loadDrugData } from '../utils/supabaseLoader';
import DrugDashboard from './DrugDashboard';
import './Upload.css';

export default function Upload() {
  const location = useLocation();
  const initialDrug = DRUGS.find(d => d.id === location.state?.drugId) ?? DRUGS[0];
  const [selectedDrug, setSelectedDrug]   = useState(initialDrug);
  const [activeSection, setActiveSection] = useState(DRUGS[0].id);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [result, setResult]               = useState(null);

  // 약 선택 시 자동 로드
  useEffect(() => {
    handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDrug]);

  const handleLoad = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await loadDrugData(selectedDrug);
      setResult(data);
    } catch (e) {
      setError(e.message || '데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 결과 있음 → 대시보드 유지, 로딩/에러는 오버레이
  if (result) {
    return (
      <div style={{ position: 'relative' }}>
        {loading && <div className="upload-loading-bar" />}
        {error && (
          <div className="upload-error-toast">
            <span>⚠</span>
            <span>{error}</span>
            <button className="upload-error-toast__close" onClick={() => setError('')}>✕</button>
          </div>
        )}
        <DrugDashboard
          result={result}
          onDrugChange={(drug) => { setSelectedDrug(drug); setActiveSection(drug.id); }}
          activeSection={activeSection}
          onDashboardClick={() => setActiveSection('dashboard')}
        />
      </div>
    );
  }

  // 첫 로딩 중
  if (loading) {
    return (
      <div className="upload-spinner-wrap">
        <span className="upload-zone__spinner" />
        <p className="upload-spinner-label">{selectedDrug.name} 데이터 불러오는 중...</p>
      </div>
    );
  }

  // 첫 로드 실패 (result 없음) → 약 선택 가능하게
  return (
    <div className="upload-spinner-wrap">
      <div className="upload-error" style={{ maxWidth: 480 }}>
        <span>⚠</span> {error}
      </div>
      <div className="upload-drug-select">
        <p className="upload-drug-select__label">다른 약을 선택하세요</p>
        <div className="upload-drug-select__pills">
          {DRUGS.map(d => (
            <button
              key={d.id}
              className={`drug-pill${d.id === selectedDrug.id ? ' active' : ''}`}
              onClick={() => setSelectedDrug(d)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
