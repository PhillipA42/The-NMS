/**
 * API Client — centralised data access layer for the OGN Dashboard.
 *
 * Every fetch call to the Django backend flows through this module so that
 * base URL, headers, error handling, and response parsing are consistent
 * across the entire React application.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Core request function.
 * Wraps the native `fetch` with:
 *  – automatic base-URL prefixing
 *  – JSON content-type headers
 *  – standardised error capture
 *
 * @param {string} endpoint — path relative to BASE_URL (e.g. '/api/sites/')
 * @param {object} options  — standard fetch options (method, body, headers …)
 * @returns {Promise<any>}  — parsed JSON response
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  // ── Handle non-OK responses uniformly ──────────────────────────
  if (!response.ok) {
    let errorBody = null;
    try {
      errorBody = await response.json();
    } catch {
      // response body isn't JSON — ignore
    }

    const error = new Error(
      errorBody?.detail || errorBody?.message || `Request failed: ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.data = errorBody;
    throw error;
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) return null;

  // Binary responses (e.g. Excel export)
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  return response.json();
}

// ── Convenience wrappers ────────────────────────────────────────────

const api = {
  get:    (endpoint, opts = {}) => request(endpoint, { ...opts, method: 'GET' }),
  post:   (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'POST', body: JSON.stringify(body) }),
  put:    (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
  patch:  (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, opts = {}) => request(endpoint, { ...opts, method: 'DELETE' }),

  /**
   * Download a binary blob (e.g. .xlsx export).
   * Returns the raw Response so the caller can call `.blob()`.
   */
  download: (endpoint, opts = {}) => request(endpoint, { ...opts, method: 'GET' }),
};

export default api;
