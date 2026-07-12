import React from 'react';
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

const Dashboard = () => {
  // In a real application, these metrics would be calculated from the API
  const mockMetrics = {
    total: 248,
    up: 241,
    down: 7,
    uptime: "99.8%"
  };

  const mockRegionData = [
    { id: 1, name: 'Nairobi Region', up: 120, down: 0, availability: 100 },
    { id: 2, name: 'Nyanza Region', up: 42, down: 2, availability: 95.4 },
    { id: 3, name: 'Coast Region', up: 55, down: 7, availability: 88.7 },
    { id: 4, name: 'Western Region', up: 24, down: 15, availability: 61.5 },
  ];

  const mockDownSites = [
    { id: 1, site: 'URI-URIRI-P5800', region: 'Nyanza', contractor: 'Safaricom', lastPolled: '9m ago' },
    { id: 2, site: 'URI-URIRI-C5900', region: 'Nyanza', contractor: 'Safaricom', lastPolled: '14m ago' },
    { id: 3, site: 'KSM-CEN-H02', region: 'Nyanza', contractor: 'Liquid Telecom', lastPolled: '22m ago' },
    { id: 4, site: 'MOM-TOWN-C01', region: 'Coast', contractor: 'Telkom', lastPolled: '1h 5m ago' },
    { id: 5, site: 'MOM-TOWN-C02', region: 'Coast', contractor: 'Telkom', lastPolled: '1h 12m ago' }
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Network Overview</h1>
        <p className="dashboard-subtitle">Real-time status of OGN infrastructure</p>
      </div>
      
      <div className="kpi-grid">
        <KPICard title="Total Sites" value={mockMetrics.total} type="neutral" />
        <KPICard title="Sites Up" value={mockMetrics.up} type="success" />
        <KPICard title="Sites Down" value={mockMetrics.down} type="danger" />
        <KPICard title="Uptime %" value={mockMetrics.uptime} type="info" />
      </div>

      <div className="dashboard-content-main">
        <div className="dashboard-panel table-panel">
          <h3>Status by Region</h3>
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
                {mockRegionData.map(region => (
                  <tr key={region.id}>
                    <td className="font-medium text-main">{region.name}</td>
                    <td className="text-success">{region.up}</td>
                    <td className={region.down > 0 ? "text-danger" : "text-muted"}>{region.down}</td>
                    <td>
                      <ProgressBar percentage={region.availability} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="dashboard-panel side-panel">
          <h3>Recent down sites</h3>
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
                {mockDownSites.map(site => (
                  <tr key={site.id}>
                    <td><a href="#" className="site-link">{site.site}</a></td>
                    <td>{site.region}</td>
                    <td>{site.contractor}</td>
                    <td>{site.lastPolled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
