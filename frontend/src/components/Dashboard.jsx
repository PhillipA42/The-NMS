import React, { useMemo } from 'react';
import { useDashboardData, useNetworkData } from '../hooks/useNetworkData';
import './Dashboard.css';

const KPICard = ({ title, value, type }) => {
  return (
    <div className={`kpi-card kpi-${type}`}>
      <div className="kpi-header">
        <h3 className="kpi-title">{title}</h3>
      </div>
      <div className="kpi-body">
        <span className="kpi-value">{value}</span>
      </div>
      <div className="kpi-accent-line"></div>
    </div>
  );
};

const ProgressBar = ({ percentage }) => {
  let colorClass = 'bar-excellent';
  if (percentage < 80) colorClass = 'bar-critical';
  else if (percentage < 95) colorClass = 'bar-warning';

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-background">
        <div
          className={`progress-bar-fill ${colorClass}`}
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
        ></div>
      </div>
      <span className="progress-bar-text">{percentage.toFixed(1)}%</span>
    </div>
  );
};

const formatTimestamp = (isoValue) => {
  if (!isoValue) return 'Unknown';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const Dashboard = () => {
  const {
    dashboardSummary: metrics,
    regionStatus: regionRows,
    recentDown: recentRows,
    initialLoading,
    lastRefreshedAt,
    triggerLivePoll,
    errors,
  } = useDashboardData();

  const hasDataError = Boolean(errors.dashboardSummary || errors.regionStatus || errors.recentDown);

  // Debug panel values to help debug missing data
  const { reportTable, sidebarTree } = useNetworkData();

  const safeMetrics = metrics || { total_sites: 0, sites_up: 0, sites_down: 0, uptime: 0 };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Network Overview</h1>
          <p className="dashboard-subtitle">Real-time status of OGN infrastructure</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <p className="dashboard-subtitle" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            {lastRefreshedAt ? `Last refresh: ${formatTimestamp(lastRefreshedAt)}` : 'Waiting for backend sync'}
          </p>
          <button
            className="refresh-btn"
            type="button"
            onClick={() => {
              try { triggerLivePoll(); } catch (e) { /* ignore */ }
            }}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
          >
            Poll Live Status
          </button>
        </div>
      </div>

      {/* Debug panel removed — dashboard now displays derived live data from the context */}

      {initialLoading ? (
        <div className="kpi-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="kpi-card loading-card">
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line skeleton-value"></div>
            </div>
          ))}
        </div>
      ) : hasDataError ? (
        <div className="empty-state">No live data available yet.</div>
      ) : (
        <div className="kpi-grid">
          <KPICard title="Total Sites" value={safeMetrics.total_sites} type="neutral" />
          <KPICard title="Sites Up" value={safeMetrics.sites_up} type="success" />
          <KPICard title="Sites Down" value={safeMetrics.sites_down} type="danger" />
          <KPICard title="Uptime %" value={`${Number(safeMetrics.uptime).toFixed(1)}%`} type="info" />
        </div>
      )}

      <div className="dashboard-content-main">
        <div className="dashboard-panel table-panel">
          <h3>Status by Region</h3>
          {errors.regionStatus ? (
            <div className="empty-state">No region data available yet.</div>
          ) : initialLoading ? (
            <div className="table-loading-skeleton">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="region-table">
                <thead>
                  <tr>
                    <th>Region Name</th>
                    <th>Up Count</th>
                    <th>Down Count</th>
                    <th>Availability Score</th>
                  </tr>
                </thead>
                <tbody>
                  {regionRows.map((region, index) => (
                    <tr key={`${region.region_name}-${index}`}>
                      <td className="font-medium text-main">{region.region_name}</td>
                      <td className="text-success">{region.up_count}</td>
                      <td className={region.down_count > 0 ? 'text-danger' : 'text-muted'}>{region.down_count}</td>
                      <td>
                        <ProgressBar percentage={region.availability_score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dashboard-panel side-panel">
          <h3>Recent down sites</h3>
          {errors.recentDown ? (
            <div className="empty-state">No recent down-site data available yet.</div>
          ) : initialLoading ? (
            <div className="table-loading-skeleton">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </div>
          ) : recentRows.length === 0 ? (
            <div className="empty-state">No down sites currently reported.</div>
          ) : (
            <div className="side-table-responsive">
              <table className="side-table">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Region</th>
                    <th>Contractor</th>
                    <th>Polled</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map(site => (
                    <tr key={site.id || site.site_code}>
                      <td>
                        <div className="font-medium text-main">{site.name || site.site_code}</div>
                        <div className="text-muted">{site.site_code}</div>
                      </td>
                      <td>{site.region}</td>
                      <td>{site.contractor}</td>
                      <td>{formatTimestamp(site.last_ping_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
