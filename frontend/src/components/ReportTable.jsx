import React, { useState, useMemo } from 'react';
import useApi from '../hooks/useApi';
import { useNetworkData } from '../hooks/useNetworkData';
import ENDPOINTS from '../services/endpoints';
import './ReportTable.css';

const normalizeContractorRow = (row) => ({
  id: row.id,
  region: row.region || '',
  county: row.county || '',
  company: row.company_name || '',
  email: row.email || '',
  phone: row.phone || '',
});

const normalizeOfficerRow = (row) => ({
  id: row.id,
  region: row.assigned_region || '',
  county: '',
  name: row.name || '',
  email: row.email || '',
  phone: row.phone || '',
});

const normalizeManifestRow = (row = {}) => ({
  id: row.id,
  region: row.region_name || '',
  county: row.county_name || '',
  name: row.site_name || row.name || '',
  sitename: row.site_name || row.name || '',
  ipAddress: row.ip_address || '',
  currentStatus: row.current_status === undefined ? true : Boolean(row.current_status),
  lastping: row.last_ping || row.last_ping_time || 'Unknown',
});

const computeRowSpans = (data) => {
  const spans = { region: {}, county: {} };

  data.forEach((row, i) => {
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

const ReportTable = ({ mode = 'manifest' }) => {
  const isManifestMode = mode === 'manifest';
  const isContractorMode = mode === 'contractors';
  const isIctMode = mode === 'ictOfficers';
  const { data: manifestData, loading: manifestLoading } = useApi(ENDPOINTS.REPORTS_TABLE, {
    immediate: isManifestMode,
  });
  const { data: contractorData, loading: contractorLoading } = useApi(ENDPOINTS.CONTRACTORS, {
    immediate: isContractorMode,
  });
  const { data: officerData, loading: officerLoading } = useApi(ENDPOINTS.ICT_OFFICERS, {
    immediate: isIctMode,
  });

  const { reportTable } = useNetworkData();

  const manifestRows = useMemo(() => {
    const source = Array.isArray(reportTable) && reportTable.length > 0 ? reportTable : manifestData;
    return Array.isArray(source) ? source.map(normalizeManifestRow) : [];
  }, [manifestData, reportTable]);
  const contractorRows = useMemo(
    () => Array.isArray(contractorData) ? contractorData.map(normalizeContractorRow) : [],
    [contractorData]
  );
  const officerRows = useMemo(
    () => Array.isArray(officerData) ? officerData.map(normalizeOfficerRow) : [],
    [officerData]
  );

  const tableRows = useMemo(() => {
    if (isContractorMode) return contractorRows;
    if (isIctMode) return officerRows;
    return manifestRows;
  }, [contractorRows, officerRows, isContractorMode, isIctMode, manifestRows]);

  const isTableLoading = isManifestMode ? manifestLoading : isContractorMode ? contractorLoading : officerLoading;

  const title = isIctMode ? 'ICT Officers' : isContractorMode ? 'Contractors' : 'Network Manifest';
  const subtitle = isIctMode
    ? 'Regional ICT officers and contact details'
    : isContractorMode
      ? 'Regional contractor and company contact matrix'
      : 'Full inventory and status of all OGN sites';

  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [countyFilter, setCountyFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  const uniqueRegions = useMemo(() => [...new Set(tableRows.map(row => row.region))], [tableRows]);
  const uniqueCounties = useMemo(() => [...new Set(tableRows.map(row => row.county))], [tableRows]);

  const filteredData = useMemo(() => {
    return tableRows.filter(row => {
      if (isManifestMode && statusFilter === 'up' && !row.status) return false;
      if (isManifestMode && statusFilter === 'down' && row.status) return false;
      if (regionFilter !== 'all' && row.region !== regionFilter) return false;
      if (countyFilter !== 'all' && row.county !== countyFilter) return false;
      return true;
    });
  }, [countyFilter, isManifestMode, regionFilter, statusFilter, tableRows]);

  const rowSpans = useMemo(() => computeRowSpans(filteredData), [filteredData]);

  const availableCounties = useMemo(() => {
    if (regionFilter === 'all') return uniqueCounties;
    return [...new Set(tableRows.filter(row => row.region === regionFilter).map(row => row.county))];
  }, [regionFilter, tableRows, uniqueCounties]);

  const handleRegionChange = (value) => {
    setRegionFilter(value);
    setCountyFilter('all');
  };

  const handleExport = async () => {
    if (!isManifestMode) return;

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

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-header-top">
          <div>
            <h1 className="report-title">{title}</h1>
            <p className="report-subtitle">{subtitle}</p>
          </div>
          {isManifestMode && (
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
          )}
        </div>
      </div>

      <div className="filter-banner">
        {isManifestMode && (
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
        )}

        <div className="filter-group">
          <span className="filter-label">Region</span>
          <select
            className="filter-select"
            value={regionFilter}
            onChange={(e) => handleRegionChange(e.target.value)}
          >
            <option value="all">All Regions</option>
            {uniqueRegions.map(region => (
              <option key={region} value={region}>{region}</option>
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
            {availableCounties.map(county => (
              <option key={county} value={county}>{county}</option>
            ))}
          </select>
        </div>

        <div className="filter-result-count">
          <span className="result-count-number">{filteredData.length}</span>
          <span className="result-count-label"> {isManifestMode ? 'sites' : 'records'}</span>
        </div>
      </div>

      <div className="report-table-wrapper">
        {isTableLoading ? (
          <div className="loading-skeleton">
            <div className="skeleton-bar" style={{ width: '80%' }}></div>
            <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
            <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="empty-table-state">No matching records found.</div>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>County</th>
                {isManifestMode ? (
                  <>
                    <th>Name</th>
                    <th>County</th>
                    <th>SiteName</th>
                    <th>IP Address</th>
                    <th className="text-center">Current Status</th>
                    <th>LastPing</th>
                  </>
                ) : isContractorMode ? (
                  <>
                    <th>Company</th>
                    <th>Email</th>
                  </>
                ) : (
                  <>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                  </>
                )}
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
                  {isManifestMode ? (
                    <>
                      <td className="font-medium text-main">{row.name}</td>
                      <td>{row.county}</td>
                      <td>{row.sitename}</td>
                      <td>{row.ipAddress}</td>
                      <td className="status-cell">
                        <div className={`status-box ${row.currentStatus ? 'status-up' : 'status-down'}`}>
                          {row.currentStatus ? 'Up' : 'Down'}
                        </div>
                      </td>
                      <td>{row.lastping === 'Unknown' ? 'Unknown' : new Date(row.lastping).toLocaleString()}</td>
                    </>
                  ) : isContractorMode ? (
                    <>
                      <td className="font-medium text-main">{row.company}</td>
                      <td>{row.email}</td>
                    </>
                  ) : (
                    <>
                      <td className="font-medium text-main">{row.name}</td>
                      <td>{row.email}</td>
                      <td>{row.phone}</td>
                    </>
                  )}
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
