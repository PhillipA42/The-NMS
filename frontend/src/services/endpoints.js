/**
 * Endpoint constants — single source of truth for every API path
 * referenced across the React frontend.
 */

const ENDPOINTS = {
  // Sidebar tree
  SIDEBAR_TREE:       '/api/sidebar-tree/',

  // Dashboard
  DASHBOARD_SUMMARY:  '/api/dashboard-summary/',
  REGION_STATUS:      '/api/region-status/',
  RECENT_DOWN:        '/api/recent-down/',

  // Reports
  REPORTS_TABLE:      '/api/reports-table/',
  EXPORT_REPORT:      '/api/export-report/',

  // Escalation
  ESCALATION_DATA:    '/api/escalation-data/',
  SEND_ESCALATION:    '/api/send-escalation-email/',
};

export default ENDPOINTS;
