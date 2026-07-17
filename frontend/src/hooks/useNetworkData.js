import { useContext } from 'react';
import { NetworkDataContext } from '../context/NetworkDataContext';

/**
 * useNetworkData — full access to the centralised network polling context.
 *
 * Returns every data stream, loading flags, errors, and actions.
 * Prefer the narrower selector hooks below when a component only
 * needs a subset of the data — they make dependencies explicit and
 * keep component interfaces clean.
 */
export function useNetworkData() {
  const ctx = useContext(NetworkDataContext);
  if (!ctx) {
    throw new Error('useNetworkData must be used inside <NetworkDataProvider>');
  }
  return ctx;
}

// ── Selector Hooks ──────────────────────────────────────────────────
// Each returns only the slice of context relevant to one screen,
// reducing cognitive overhead and making component deps obvious.

/**
 * useSidebarData — data for the SidebarTree component.
 */
export function useSidebarData() {
  const { sidebarTree, initialLoading, errors, refetchAll } = useNetworkData();
  return {
    sidebarTree,
    initialLoading,
    refetchAll,
    error: errors.sidebarTree || null,
  };
}

/**
 * useDashboardData — data for the Dashboard component.
 * Bundles the KPI summary, region status table, and recent-down list.
 */
export function useDashboardData() {
  const {
    dashboardSummary,
    regionStatus,
    recentDown,
    initialLoading,
    errors,
    lastRefreshedAt,
    refetchAll,
  } = useNetworkData();

  return {
    dashboardSummary,
    regionStatus,
    recentDown,
    initialLoading,
    lastRefreshedAt,
    refetchAll,
    errors: {
      dashboardSummary: errors.dashboardSummary || null,
      regionStatus: errors.regionStatus || null,
      recentDown: errors.recentDown || null,
    },
  };
}

/**
 * useEscalationData — data for the Escalation board component.
 */
export function useEscalationData() {
  const { escalationData, initialLoading, errors, lastRefreshedAt, refetchAll } = useNetworkData();
  return {
    escalationData,
    initialLoading,
    lastRefreshedAt,
    refetchAll,
    error: errors.escalationData || null,
  };
}
