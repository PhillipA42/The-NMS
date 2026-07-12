import React, { useState, useMemo } from 'react';
import './Escalation.css';

// Mock data: all down sites with their contractor and assigned ICT officer
const mockDownSites = [
  { id: 1, site_code: 'URI-URIRI-P5800', name: 'Uriri Police HQ', region: 'Nyanza', county: 'Migori', contractor: 'Safaricom Business', downSince: '2h 14m' },
  { id: 2, site_code: 'URI-URIRI-C5900', name: 'Uriri Clinic', region: 'Nyanza', county: 'Migori', contractor: 'Safaricom Business', downSince: '1h 45m' },
  { id: 3, site_code: 'MOM-TOWN-C01', name: 'Mombasa Town Clinic', region: 'Coast', county: 'Mombasa', contractor: 'Jamii Telecom', downSince: '3h 02m' },
  { id: 4, site_code: 'MOM-TOWN-C02', name: 'Mombasa Central Office', region: 'Coast', county: 'Mombasa', contractor: 'Jamii Telecom', downSince: '2h 58m' },
  { id: 5, site_code: 'KSM-CEN-H02', name: 'Kisumu Depot', region: 'Nyanza', county: 'Kisumu', contractor: 'Liquid Intelligent Tech', downSince: '45m' },
  { id: 6, site_code: 'NAI-WES-P01', name: 'Westlands Police Post', region: 'Nairobi', county: 'Nairobi', contractor: 'Liquid Intelligent Tech', downSince: '12m' },
];

// Mock vendor contact emails
const mockVendorEmails = {
  'Safaricom Business': 'noc@safaricom.co.ke',
  'Jamii Telecom': 'support@jamii.co.ke',
  'Liquid Intelligent Tech': 'noc@liquidtelecom.com',
};

// Mock ICT officers mapped by contractor
const mockOfficers = {
  'Safaricom Business': [
    { id: 1, name: 'James Ochieng', email: 'j.ochieng@ogn.go.ke', phone: '+254 712 345 678', role: 'Area ICT Officer – Nyanza' },
  ],
  'Jamii Telecom': [
    { id: 2, name: 'Amina Hassan', email: 'a.hassan@ogn.go.ke', phone: '+254 723 456 789', role: 'Area ICT Officer – Coast' },
    { id: 3, name: 'Brian Mwangi', email: 'b.mwangi@ogn.go.ke', phone: '+254 734 567 890', role: 'Regional Supervisor – Coast' },
  ],
  'Liquid Intelligent Tech': [
    { id: 4, name: 'Catherine Wanjiku', email: 'c.wanjiku@ogn.go.ke', phone: '+254 745 678 901', role: 'Area ICT Officer – Multi-Region' },
  ],
};

// Generate a pre-filled outage email body
const generateEmailBody = (contractor, sites) => {
  const now = new Date();
  const timestamp = now.toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' });
  const siteLines = sites.map(s => `  • ${s.site_code} — ${s.name} (${s.region}, ${s.county}) — Down for ${s.downSince}`).join('\n');

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

// ─── Email Modal Component ────────────────────────────────────────────
const EmailModal = ({ contractor, sites, officers, vendorEmail, onClose }) => {
  const ccEmails = officers.map(o => o.email).join(', ');
  const [formData, setFormData] = useState({
    to: vendorEmail,
    cc: ccEmails,
    subject: `[URGENT] OGN Network Outage Report — ${contractor} — ${sites.length} Site(s) Affected`,
    body: generateEmailBody(contractor, sites),
  });
  const [sending, setSending] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSend = async () => {
    setSending(true);
    try {
      // In production this would POST to /api/send-escalation-email/
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('Escalation email dispatched successfully.');
      onClose();
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Email Contractor</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">To</label>
            <input
              type="email"
              className="modal-input"
              value={formData.to}
              onChange={e => handleChange('to', e.target.value)}
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">CC</label>
            <input
              type="text"
              className="modal-input"
              value={formData.cc}
              onChange={e => handleChange('cc', e.target.value)}
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Subject</label>
            <input
              type="text"
              className="modal-input"
              value={formData.subject}
              onChange={e => handleChange('subject', e.target.value)}
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Body</label>
            <textarea
              className="modal-textarea"
              rows="14"
              value={formData.body}
              onChange={e => handleChange('body', e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-send" onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <span className="modal-spinner"></span>
                Sending…
              </>
            ) : (
              <>
                <MailIcon /> Send Email Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Escalation Page ─────────────────────────────────────────────
const Escalation = () => {
  const [modalData, setModalData] = useState(null);

  // Group down sites by contractor
  const groupedByContractor = useMemo(() => {
    const groups = {};
    mockDownSites.forEach(site => {
      if (!groups[site.contractor]) groups[site.contractor] = [];
      groups[site.contractor].push(site);
    });
    return groups;
  }, []);

  const contractors = Object.keys(groupedByContractor);

  const openModal = (contractor, sites, officers) => {
    setModalData({
      contractor,
      sites,
      officers,
      vendorEmail: mockVendorEmails[contractor] || '',
    });
  };

  return (
    <div className="escalation-container">
      <div className="escalation-header">
        <div>
          <h1 className="escalation-title">Escalation Board</h1>
          <p className="escalation-subtitle">Unreachable sites grouped by servicing contractor</p>
        </div>
        <div className="escalation-summary">
          <span className="summary-count">{mockDownSites.length}</span>
          <span className="summary-label">sites down</span>
        </div>
      </div>

      <div className="escalation-stack">
        {contractors.map(contractor => {
          const sites = groupedByContractor[contractor];
          const officers = mockOfficers[contractor] || [];

          return (
            <div className="contractor-card" key={contractor}>
              <div className="contractor-card-header">
                <h2 className="contractor-name">{contractor}</h2>
                <div className="contractor-header-actions">
                  <span className="contractor-badge">{sites.length} site{sites.length !== 1 ? 's' : ''} down</span>
                  <button className="email-contractor-btn" onClick={() => openModal(contractor, sites, officers)}>
                    <MailIcon /> Email Contractor
                  </button>
                </div>
              </div>

              {/* Down Sites Table */}
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
                      <tr key={site.id}>
                        <td className="code-cell">{site.site_code}</td>
                        <td className="name-cell">{site.name}</td>
                        <td>{site.region}</td>
                        <td>{site.county}</td>
                        <td className="duration-cell">{site.downSince}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ICT Officers */}
              {officers.length > 0 && (
                <div className="officers-section">
                  <h4 className="officers-heading">Area ICT Officer{officers.length > 1 ? 's' : ''}</h4>
                  <div className="officers-list">
                    {officers.map(officer => (
                      <div className="officer-card" key={officer.id}>
                        <div className="officer-avatar">{officer.name.split(' ').map(n => n[0]).join('')}</div>
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

      {/* Email Modal */}
      {modalData && (
        <EmailModal
          contractor={modalData.contractor}
          sites={modalData.sites}
          officers={modalData.officers}
          vendorEmail={modalData.vendorEmail}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
};

export default Escalation;
