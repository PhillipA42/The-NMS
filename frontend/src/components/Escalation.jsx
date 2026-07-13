import React, { useMemo } from 'react';
import { useEscalationData } from '../hooks/useNetworkData';
import './Escalation.css';

const generateEmailBody = (contractor, sites) => {
  const now = new Date();
  const timestamp = now.toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' });
  const siteLines = sites
    .map(site => `  • ${site.site_code} — ${site.name} (${site.region}, ${site.county}) — Down since ${site.down_since}`)
    .join('\n');

  return `Dear ${contractor} Support Team,

We are writing to formally report a connectivity outage affecting the following OGN network site(s) serviced under your contract:

${siteLines}

The above site(s) have been unreachable since the indicated durations as of ${timestamp}. This is impacting government service delivery in the affected regions.

We kindly request your urgent intervention to investigate and restore connectivity at the earliest opportunity. Please provide an estimated time of resolution (ETR) within 2 hours of receiving this communication.

For any on-site coordination, please liaise with the Area ICT Officer(s) copied on this email.

Regards,
OGN Network Operations Centre`;
};

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const formatDownSince = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

const buildMailtoLink = (contractor, sites, officers, vendorEmail) => {
  const ccEmails = officers.map(officer => officer.email).filter(Boolean).join(', ');
  const subject = encodeURIComponent(`[URGENT] OGN Network Outage Report — ${contractor} — ${sites.length} Site(s) Affected`);
  const body = encodeURIComponent(generateEmailBody(contractor, sites));
  const to = encodeURIComponent(vendorEmail || '');
  const cc = encodeURIComponent(ccEmails);

  return `mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`;
};

const Escalation = () => {
  const { escalationData, initialLoading, error } = useEscalationData();

  const groupedByContractor = useMemo(() => {
    const groups = {};
    const source = Array.isArray(escalationData) ? escalationData : [];

    source.forEach(group => {
      const contractor = group.contractor || 'Unassigned';
      groups[contractor] = {
        contractor,
        vendorEmail: group.vendor_email || '',
        sites: Array.isArray(group.sites) ? group.sites : [],
        officers: Array.isArray(group.officers) ? group.officers : [],
      };
    });

    return groups;
  }, [escalationData]);

  const contractors = Object.keys(groupedByContractor);
  const totalDownSites = contractors.reduce((total, contractor) => total + groupedByContractor[contractor].sites.length, 0);

  const openMailClient = (contractor, sites, officers) => {
    const vendorEmail = groupedByContractor[contractor]?.vendorEmail || '';
    const mailtoUrl = buildMailtoLink(contractor, sites, officers, vendorEmail);

    if (typeof window !== 'undefined') {
      window.location.href = mailtoUrl;
    }
  };

  return (
    <div className="escalation-container">
      <div className="escalation-header">
        <div>
          <h1 className="escalation-title">Escalation Board</h1>
          <p className="escalation-subtitle">Unreachable sites grouped by servicing contractor</p>
        </div>
        <div className="escalation-summary">
          <span className="summary-count">{totalDownSites}</span>
          <span className="summary-label">sites down</span>
        </div>
      </div>

      {initialLoading ? (
        <div className="loading-skeleton escalation-loading">
          <div className="skeleton-bar" style={{ width: '80%' }}></div>
          <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
          <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
        </div>
      ) : error ? (
        <div className="empty-state">Unable to load escalation profiles.</div>
      ) : (
        <div className="escalation-stack">
          {contractors.map(contractor => {
            const group = groupedByContractor[contractor];
            const sites = group.sites || [];
            const officers = group.officers || [];

            return (
              <div className="contractor-card" key={contractor}>
                <div className="contractor-card-header">
                  <h2 className="contractor-name">{contractor}</h2>
                  <div className="contractor-header-actions">
                    <span className="contractor-badge">{sites.length} site{sites.length !== 1 ? 's' : ''} down</span>
                    <button className="email-contractor-btn" onClick={() => openMailClient(contractor, sites, officers)}>
                      <MailIcon /> Compose Email
                    </button>
                  </div>
                </div>

                <div className="contractor-table-wrapper">
                  <table className="contractor-table">
                    <thead>
                      <tr>
                        <th>Site Code</th>
                        <th>Site Name</th>
                        <th>Region</th>
                        <th>County</th>
                        <th>Down Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map(site => (
                        <tr key={site.id || site.site_code}>
                          <td className="code-cell">{site.site_code}</td>
                          <td className="name-cell">{site.name}</td>
                          <td>{site.region}</td>
                          <td>{site.county}</td>
                          <td className="duration-cell">{formatDownSince(site.down_since)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {officers.length > 0 && (
                  <div className="officers-section">
                    <h4 className="officers-heading">Area ICT Officer{officers.length > 1 ? 's' : ''}</h4>
                    <div className="officers-list">
                      {officers.map(officer => (
                        <div className="officer-card" key={officer.id}>
                          <div className="officer-avatar">{officer.name.split(' ').map(name => name[0]).join('')}</div>
                          <div className="officer-info">
                            <span className="officer-name">{officer.name}</span>
                            <span className="officer-role">{officer.role}</span>
                            <div className="officer-contacts">
                              <a href={`mailto:${officer.email}`} className="officer-link">
                                <MailIcon /> {officer.email}
                              </a>
                              <a href={`tel:${officer.phone.replace(/\s/g, '')}`} className="officer-link">
                                <PhoneIcon /> {officer.phone}
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Escalation;
