import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { DRUGS } from '../config/drugs';
import '../pages/DrugDashboard.css';
import '../pages/Admin.css';

/**
 * 관리자 페이지 공통 레이아웃.
 * heading: 구분선 위 회색 영역에 표시 (제목/breadcrumb 등)
 * children: 구분선 아래 흰색 영역에 표시
 */
export default function AdminLayout({ heading, children }) {
  const navigate = useNavigate();

  return (
    <div className="ag-root">
      <Sidebar
        drugs={DRUGS}
        activeSection="admin"
        onDrugChange={(drug) => navigate('/', { state: { drugId: drug.id } })}
        onDashboardClick={() => navigate('/')}
      />
      <div className="ag-main">
        {/* 구분선 위: 회색 배경, 고정 높이 */}
        <div className="ag-content admin-head">
          {heading}
        </div>

        {/* 구분선: ag-main 전체 너비 */}
        <div className="admin-full-divider" />

        {/* 구분선 아래: 흰색 배경 */}
        <div className="admin-body-wrap">
          <div className="ag-content ag-content--compact">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
