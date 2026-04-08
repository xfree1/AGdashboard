import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Upload from './pages/Upload';
import Admin from './pages/Admin';
import DataPreview from './pages/DataPreview';
import UploadConfirm from './pages/UploadConfirm';
import './styles/variables.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/preview/:drugId" element={<DataPreview />} />
        <Route path="/admin/upload-confirm" element={<UploadConfirm />} />
        <Route path="*" element={<Upload />} />
      </Routes>
    </Router>
  );
}

export default App;
