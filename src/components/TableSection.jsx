import React, { useState, useMemo } from 'react';
import './TableSection.css';

/**
 * TableSection
 * @param {Array} headers      - 컬럼 헤더 배열
 * @param {Array} rows         - 데이터 행 배열 (각 행은 배열)
 * @param {string} [title]     - 테이블 제목
 * @param {number} [pageSize]  - 페이지당 행 수 (기본 20)
 * @param {boolean} [loading]  - 로딩 상태
 */
export default function TableSection({
  headers = [],
  rows = [],
  title,
  pageSize = 20,
  loading = false,
}) {
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  /* 검색 필터 */
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(row =>
      row.some(cell => String(cell ?? '').toLowerCase().includes(q))
    );
  }, [rows, search]);

  /* 정렬 */
  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      const an = parseFloat(String(av).replace(/,/g, ''));
      const bn = parseFloat(String(bv).replace(/,/g, ''));
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortCol, sortDir]);

  /* 페이지네이션 */
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (colIdx) => {
    if (sortCol === colIdx) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className="table-section">
      <div className="table-section__header">
        {title && <p className="table-section__title">{title}</p>}
        <div className="table-section__controls">
          <span className="table-section__count text-mono text-muted">
            {loading ? '—' : `${filtered.length.toLocaleString()}행`}
          </span>
          <input
            className="table-section__search"
            type="text"
            placeholder="검색..."
            value={search}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="table-section__wrap">
        {loading ? (
          <div className="table-section__empty">불러오는 중...</div>
        ) : paged.length === 0 ? (
          <div className="table-section__empty">
            {search ? '검색 결과 없음' : '데이터 없음'}
          </div>
        ) : (
          <table className="table-section__table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    onClick={() => handleSort(i)}
                    className={sortCol === i ? 'active' : ''}
                  >
                    {h}
                    <span className="sort-icon">
                      {sortCol === i ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci}>{row[ci] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="table-section__pagination">
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ←
          </button>
          <span className="text-mono text-muted" style={{ fontSize: 'var(--text-xs)' }}>
            {page} / {totalPages}
          </span>
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
