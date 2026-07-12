import React, { useState, useMemo } from 'react';
import './ReportTable.css';

const mockData = [
  { id: 1, region: 'Nyanza', county: 'Migori', sub_county: 'Uriri', name: 'Uriri Huduma', site_code: 'URI-URIRI-S5700', status: true },
  { id: 2, region: 'Nyanza', county: 'Migori', sub_county: 'Uriri', name: 'Uriri Police HQ', site_code: 'URI-URIRI-P5800', status: false },
  { id: 3, region: 'Nyanza', county: 'Kisumu', sub_county: 'Kisumu Central', name: 'Kisumu Hospital', site_code: 'KSM-CEN-H01', status: true },
  { id: 4, region: 'Nyanza', county: 'Kisumu', sub_county: 'Kisumu East', name: 'Kisumu Clinic', site_code: 'KSM-EST-C02', status: true },
  { id: 5, region: 'Coast', county: 'Mombasa', sub_county: 'Mvita', name: 'Mombasa Town Clinic', site_code: 'MOM-TOWN-C01', status: false },
  { id: 6, region: 'Coast', county: 'Mombasa', sub_county: 'Likoni', name: 'Likoni HQ', site_code: 'MOM-LIK-H01', status: true },
  { id: 7, region: 'Coast', county: 'Kilifi', sub_county: 'Malindi', name: 'Malindi Center', site_code: 'KIL-MAL-C01', status: true },
];

// Extract unique regions and counties from the dataset
const uniqueRegions = [...new Set(mockData.map(r => r.region))];
const uniqueCounties = [...new Set(mockData.map(r => r.county))];

// Compute rowspan map for a given ordered dataset
const computeRowSpans = (data) => {
  const spans = { region: {}, county: {} };

  data.forEach((row, i) => {
    // Region span
    if (i === 0 || data[i - 1].region !== row.region) {
      let count = 1;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].region === row.region) count++;
        else break;
      }
      spans.region[i] = count;
    } else {
      spans.region[i] = 0;
    }

    // County span
    if (i === 0 || data[i - 1].region !== row.region || data[i - 1].county !== row.county) {
      let count = 1;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].region === row.region && data[j].county === row.county) count++;
        else break;
      }
      spans.county[i] = count;
    } else {
      spans.county[i] = 0;
    }
  });

  return spans;
};

const ReportTable = () => {
  const [statusFilter, setStatusFilter] = useState('all');   // 'all' | 'up' | 'down'
  const [regionFilter, setRegionFilter] = useState('all');
  const [countyFilter, setCountyFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Handle Excel export — sends current filters to the backend
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (regionFilter !== 'all') params.append('region', regionFilter);
      if (countyFilter !== 'all') params.append('county', countyFilter);

      const response = await fetch(`/api/export-report/?${params.toString()}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OGN_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // Derive filtered dataset
  const filteredData = useMemo(() => {
    return mockData.filter(row => {
      if (statusFilter === 'up' && !row.status) return false;
      if (statusFilter === 'down' && row.status) return false;
      if (regionFilter !== 'all' && row.region !== regionFilter) return false;
      if (countyFilter !== 'all' && row.county !== countyFilter) return false;
      return true;
    });
  }, [statusFilter, regionFilter, countyFilter]);

  // Recompute rowspans on filtered dataset
  const rowSpans = useMemo(() => computeRowSpans(filteredData), [filteredData]);

  // Derive available counties based on the current region filter
  const availableCounties = useMemo(() => {
    if (regionFilter === 'all') return uniqueCounties;
    return [...new Set(mockData.filter(r => r.region === regionFilter).map(r => r.county))];
  }, [regionFilter]);

  // Reset county filter if it's no longer valid after region changes
  const handleRegionChange = (value) => {
    setRegionFilter(value);
    setCountyFilter('all');
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-header-top">
          <div>
            <h1 className="report-title">Network Manifest</h1>
            <p className="report-subtitle">Full inventory and status of all OGN sites</p>
          </div>
          <button
            className={`export-btn ${exporting ? 'export-btn-loading' : ''}`}
            onClick={handleExport}
            disabled={exporting}
          >
            <svg className="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            {exporting ? (
              <>
                <span className="export-spinner"></span>
                Exporting…
              </>
            ) : (
              'Export Excel'
            )}
          </button>
        </div>
      </div>

      {/* Filter Controls Banner */}
      <div className="filter-banner">
        <div className="filter-group">
          <span className="filter-label">Status</span>
          <div className="pill-group">
            <button
              className={`pill ${statusFilter === 'all' ? 'pill-active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >All</button>
            <button
              className={`pill pill-up ${statusFilter === 'up' ? 'pill-active' : ''}`}
              onClick={() => setStatusFilter('up')}
            >Up</button>
            <button
              className={`pill pill-down ${statusFilter === 'down' ? 'pill-active' : ''}`}
              onClick={() => setStatusFilter('down')}
            >Down</button>
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Region</span>
          <select
            className="filter-select"
            value={regionFilter}
            onChange={(e) => handleRegionChange(e.target.value)}
          >
            <option value="all">All Regions</option>
            {uniqueRegions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">County</span>
          <select
            className="filter-select"
            value={countyFilter}
            onChange={(e) => setCountyFilter(e.target.value)}
          >
            <option value="all">All Counties</option>
            {availableCounties.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="filter-result-count">
          <span className="result-count-number">{filteredData.length}</span>
          <span className="result-count-label"> sites</span>
        </div>
      </div>

      <div className="report-table-wrapper">
        {filteredData.length === 0 ? (
          <div className="empty-table-state">No sites match the current filters.</div>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>County</th>
                <th>Sub-County</th>
                <th>Site</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, index) => (
                <tr key={row.id}>
                  {rowSpans.region[index] > 0 && (
                    <td rowSpan={rowSpans.region[index]} className="grouped-cell region-cell">
                      {row.region}
                    </td>
                  )}
                  {rowSpans.county[index] > 0 && (
                    <td rowSpan={rowSpans.county[index]} className="grouped-cell county-cell">
                      {row.county}
                    </td>
                  )}
                  <td>{row.sub_county}</td>
                  <td className="font-medium text-main">{row.name}</td>
                  <td className="status-cell">
                    <div className={`status-box ${row.status ? 'status-up' : 'status-down'}`}>
                      {row.status ? '1' : '0'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ReportTable;
