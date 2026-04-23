import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DRUGS } from './config/drugs';
import DrugPage             from './pages/DrugPage';
import WeeklyPage           from './pages/WeeklyPage';
import Admin                from './pages/Admin';
import DataPreview          from './pages/DataPreview';
import UploadConfirm        from './pages/UploadConfirm';
import MainLayout           from './components/MainLayout';
import UbistSummary         from './components/UbistSummary';
import UbistCompanyAll      from './components/UbistCompanyAll';
import UbistCompanyClinic   from './components/UbistCompanyClinic';
import UbistCompanyHospital from './components/UbistCompanyHospital';
import UbistAngukAll        from './components/UbistAngukAll';
import RouteProgress        from './components/RouteProgress';
import './styles/variables.css';
import './styles/table.css';

function App() {
  return (
    <Router>
      <RouteProgress />
      <Routes>
        {/* 기본 진입 → 첫 번째 품목으로 리다이렉트 */}
        <Route path="/"       element={<Navigate to={`/drug/${DRUGS[0].id}`} replace />} />
        <Route path="/upload" element={<Navigate to={`/drug/${DRUGS[0].id}`} replace />} />

        {/* 8대품목 */}
        <Route path="/drug/:drugId"   element={<DrugPage />} />

        {/* 8대품목 위클리 */}
        <Route path="/weekly/:drugId" element={<WeeklyPage />} />

        {/* 대시보드 */}
        <Route path="/dashboard" element={
          <MainLayout>
            <div className="ag-dashboard-placeholder">준비 중입니다.</div>
          </MainLayout>
        } />

        {/* 유비스트 */}
        <Route path="/ubist/summary"        element={<MainLayout tableView><UbistSummary /></MainLayout>} />
        <Route path="/ubist/company-all"    element={<MainLayout tableView><UbistCompanyAll /></MainLayout>} />
        <Route path="/ubist/company-clinic" element={<MainLayout tableView><UbistCompanyClinic /></MainLayout>} />
        <Route path="/ubist/company-hosp"   element={<MainLayout tableView><UbistCompanyHospital /></MainLayout>} />
        <Route path="/ubist/anguk-all"      element={<MainLayout tableView><UbistAngukAll /></MainLayout>} />

        {/* 어드민 */}
        <Route path="/admin"                      element={<Admin />} />
        <Route path="/admin/preview/:drugId"      element={<DataPreview />} />
        <Route path="/admin/upload-confirm"       element={<UploadConfirm />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to={`/drug/${DRUGS[0].id}`} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
