import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useLoading } from '../context/LoadingContext';

/**
 * useApi — reusable hook for data fetching with integrated
 * global loading state and standardised error handling.
 *
 * @param {string}  endpoint  — API path (e.g. '/api/sites/')
 * @param {object}  options
 * @param {boolean} options.immediate — fire the request on mount (default true)
 * @param {string}  options.loadingKey — custom key for the global loading registry
 * @param {object}  options.params — query-string params appended to the URL
 *
 * @returns {{ data, error, loading, refetch }}
 */
export default function useApi(endpoint, options = {}) {
  const { immediate = true, loadingKey, params } = options;
  const { startLoading, stopLoading } = useLoading();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const keyRef = useRef(null);

  const buildUrl = useCallback(() => {
    if (!params || Object.keys(params).length === 0) return endpoint;
    const qs = new URLSearchParams(params).toString();
    return `${endpoint}?${qs}`;
  }, [endpoint, params]);

  const fetchData = useCallback(async () => {
    const key = loadingKey || endpoint;
    keyRef.current = startLoading(key);
    setLoading(true);
    setError(null);

    try {
      const result = await api.get(buildUrl());
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      console.error(`[useApi] ${endpoint}:`, err.message);
      return null;
    } finally {
      setLoading(false);
      stopLoading(keyRef.current);
    }
  }, [endpoint, buildUrl, loadingKey, startLoading, stopLoading]);

  useEffect(() => {
    if (immediate) fetchData();
  }, [immediate, fetchData]);

  return { data, error, loading, refetch: fetchData };
}
