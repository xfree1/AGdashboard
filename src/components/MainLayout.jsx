import Sidebar from './Sidebar';
import './MainLayout.css';

export default function MainLayout({ children, tableView = false }) {
  return (
    <div className={`ag-root${tableView ? ' ag-root--table-view' : ''}`}>
      <Sidebar />
      <div className="ag-main">
        {children}
      </div>
    </div>
  );
}
