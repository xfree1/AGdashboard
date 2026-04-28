import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NProgress from 'nprogress';
import { DRUGS } from '../config/drugs';
import { loadDrugData, buildDummyDrugData } from '../utils/supabaseLoader';
import DrugDashboard from './DrugDashboard';
import Sidebar from '../components/Sidebar';
import './DrugPage.css';

export default function DrugPage() {
  const { drugId } = useParams();
  const drug = DRUGS.find(d => d.id === drugId) ?? DRUGS[0];

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null);

  useEffect(() => {
    NProgress.start();
    setError('');
    setLoading(true);
    loadDrugData(drug)
      .then(data  => { setResult(data); })
      .catch(()   => { setResult(buildDummyDrugData(drug)); })
      .finally(() => { setLoading(false); NProgress.done(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drugId]);

  // 첫 로드 — 사이드바 유지하면서 콘텐츠 영역만 스켈레톤
  if (!result) {
    return (
      <div className="ag-root">
        <Sidebar />
        <div className="ag-main">
          <div className="drug-skeleton">
            <div className="drug-sk-header">
              <div className="drug-sk-bar drug-sk-bar--title" />
              <div className="drug-sk-bar drug-sk-bar--sub" />
            </div>
            <div className="drug-sk-kpi-row">
              {[0,1,2,3].map(i => <div key={i} className="drug-sk-kpi" />)}
            </div>
            <div className="drug-sk-chart" />
            <div className="drug-sk-table">
              {[0,1,2,3,4,5].map(i => <div key={i} className="drug-sk-table-row" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drug-page-wrap">
      {loading && <div className="upload-loading-bar" />}
      {error && (
        <div className="upload-error-toast">
          <span>⚠</span>
          <span>{error}</span>
          <button className="upload-error-toast__close" onClick={() => setError('')}>✕</button>
        </div>
      )}
      <DrugDashboard result={result} />
    </div>
  );
}
