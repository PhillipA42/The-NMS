import React, { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import ENDPOINTS from '../services/endpoints';

/**
 * NetworkDataContext
 *
 * Centralised data provider that keeps the entire frontend synchronised
 * with the Django backend's 5-minute poller cycle.
 *
 * On mount it fires parallel fetches for every dashboard data stream,
 * then silently re-polls on a 5-minute interval.  Background refetches
 * never trigger the initial-loading skeleton — only the very first
 * fetch sets `initialLoading = true`.
 */

const POLL_INTERVAL_MS = import.meta.env.VITE_POLL_INTERVAL_MS
  ? Number(import.meta.env.VITE_POLL_INTERVAL_MS)
  : 300_000; // 5 minutes

export const NetworkDataContext = createContext(null);

/**
 * Fetch a single endpoint and return { key, data } or { key, error }.
 * Errors are captured (never thrown) so that one failing endpoint
 * doesn't tear down the whole batch.
 */
async function safeFetch(key, endpoint) {
  try {
    const data = await api.get(endpoint);
    return { key, data, error: null };
  } catch (error) {
    console.error(`[NetworkData] Failed to fetch ${key} (${endpoint}):`, error.message);
    return { key, data: null, error };
  }
}

/**
 * The five data streams we keep synchronised.
 * Each entry maps a state-key to the ENDPOINTS constant it fetches from.
 */
const DATA_STREAMS = [
  { key: 'sidebarTree',      endpoint: ENDPOINTS.SIDEBAR_TREE },
  { key: 'dashboardSummary', endpoint: ENDPOINTS.DASHBOARD_SUMMARY },
  { key: 'regionStatus',     endpoint: ENDPOINTS.REGION_STATUS },
  { key: 'recentDown',       endpoint: ENDPOINTS.RECENT_DOWN },
  { key: 'escalationData',   endpoint: ENDPOINTS.ESCALATION_DATA },
];

// ── Initial state shapes (safe defaults for consumers) ──────────────
const INITIAL_DATA = {
  sidebarTree:      [],
  dashboardSummary: null,
  regionStatus:     [],
  recentDown:       [],
  escalationData:   null,
};

export const NetworkDataProvider = ({ children }) => {
  // ── Data stores ───────────────────────────────────────────────────
  const [sidebarTree, setSidebarTree]           = useState(INITIAL_DATA.sidebarTree);
  const [dashboardSummary, setDashboardSummary] = useState(INITIAL_DATA.dashboardSummary);
  const [regionStatus, setRegionStatus]         = useState(INITIAL_DATA.regionStatus);
  const [recentDown, setRecentDown]             = useState(INITIAL_DATA.recentDown);
  const [escalationData, setEscalationData]     = useState(INITIAL_DATA.escalationData);

  // ── State flags ───────────────────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors]                 = useState({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // Track whether the very first fetch has completed
  const hasLoadedOnce = useRef(false);
  // Reference to the interval so we can reset it
  const intervalRef = useRef(null);

  /** Map of state-key → setter for dynamic dispatch */
  const setters = useMemo(() => ({
    sidebarTree:      setSidebarTree,
    dashboardSummary: setDashboardSummary,
    regionStatus:     setRegionStatus,
    recentDown:       setRecentDown,
    escalationData:   setEscalationData,
  }), []);

  /**
   * Core fetch routine.
   * Fires all data streams in parallel, applies results, and updates
   * error/loading state.  On background polls errors are logged but
   * they never overwrite previously-valid data.
   */
  const fetchAll = useCallback(async () => {
    const results = await Promise.all(
      DATA_STREAMS.map(({ key, endpoint }) => safeFetch(key, endpoint))
    );

    const newErrors = {};

    results.forEach(({ key, data, error }) => {
      if (error) {
        newErrors[key] = error;
        // On background refetches, keep stale-but-valid data — don't overwrite
        return;
      }
      // Apply fresh data via the matching setter
      const setter = setters[key];
      if (setter) setter(data);
    });

    setErrors(newErrors);
    setLastRefreshedAt(new Date());

    // The first successful fetch turns off the initial loading state
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      setInitialLoading(false);
    }
  }, [setters]);

  /**
   * Public action: force an immediate refetch and reset the
   * polling interval so the next auto-poll is a full 5 min away.
   */
  const refetchAll = useCallback(() => {
    fetchAll();

    // Reset the interval timer
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
  }, [fetchAll]);

  // ── Lifecycle: initial fetch + polling interval ───────────────────
  useEffect(() => {
    // Kick off the first fetch immediately
    fetchAll();

    // Start the background polling interval
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  // ── Context value (memoised to avoid unnecessary re-renders) ──────
  const value = useMemo(() => ({
    // Data
    sidebarTree,
    dashboardSummary,
    regionStatus,
    recentDown,
    escalationData,

    // State
    initialLoading,
    errors,
    lastRefreshedAt,

    // Actions
    refetchAll,
  }), [
    sidebarTree,
    dashboardSummary,
    regionStatus,
    recentDown,
    escalationData,
    initialLoading,
    errors,
    lastRefreshedAt,
    refetchAll,
  ]);

  return (
    <NetworkDataContext.Provider value={value}>
      {children}
    </NetworkDataContext.Provider>
  );
};
