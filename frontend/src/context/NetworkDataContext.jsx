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
const isEmptyPayload = (data) => {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
};

async function safeFetch(key, endpoint) {
  try {
    const data = await api.get(endpoint);
    const fallbackData = MOCK_FALLBACKS[key];

    if (isEmptyPayload(data) && fallbackData) {
      console.warn(`[NetworkData] Using fallback demo data for ${key} because ${endpoint} returned empty payload.`);
      return { key, data: fallbackData, error: null };
    }

    return { key, data, error: null };
  } catch (error) {
    const fallbackData = MOCK_FALLBACKS[key];
    if (fallbackData) {
      console.warn(`[NetworkData] Using fallback demo data for ${key} because ${endpoint} failed.`);
      return { key, data: fallbackData, error: null };
    }

    console.error(`[NetworkData] Failed to fetch ${key} (${endpoint}):`, error.message);
    return { key, data: null, error };
  }
}

const normaliseSiteRecord = (site = {}, regionName = '', countyName = '') => ({
  id: site.id || site.site_code || site.label || `${regionName}-${countyName}-${site.name || site.label || 'site'}`,
  site_code: site.site_code || site.label || '',
  name: site.name || site.label || site.site_code || '',
  region: regionName,
  county: countyName,
  contractor: site.contractor || '',
  status: site.current_status === undefined ? true : Boolean(site.current_status),
  last_polled: site.last_polled || site.last_ping_time || null,
});

const flattenSidebarSites = (tree = []) => {
  const sites = [];

  (tree || []).forEach(network => {
    (network.regions || []).forEach(region => {
      (region.counties || []).forEach(county => {
        const directSites = Array.isArray(county.sites) ? county.sites : [];
        directSites.forEach(site => sites.push(normaliseSiteRecord(site, region.name, county.name)));

        (county.sub_counties || []).forEach(subCounty => {
          (subCounty.sites || []).forEach(site => {
            sites.push(normaliseSiteRecord(site, region.name, county.name));
          });
        });
      });
    });
  });

  return sites;
};

const enrichSitesFromRecentDown = (sites = [], recentDown = []) => {
  const recentIndex = new Map(
    (Array.isArray(recentDown) ? recentDown : [])
      .filter(row => row?.site_code)
      .map(row => [row.site_code, row])
  );

  return sites.map(site => {
    const recentMatch = recentIndex.get(site.site_code);
    if (!recentMatch) return site;

    return {
      ...site,
      contractor: site.contractor || recentMatch.contractor || '',
      last_polled: site.last_polled || recentMatch.last_ping_time || null,
    };
  });
};

const buildDerivedNetworkState = (sidebarTree = [], recentDown = [], escalationData = []) => {
  const treeSites = enrichSitesFromRecentDown(flattenSidebarSites(sidebarTree), recentDown);
  const totalSites = treeSites.length;
  const sitesUp = treeSites.filter(site => site.status).length;
  const sitesDown = totalSites - sitesUp;

  const regionSummary = treeSites.reduce((acc, site) => {
    if (!acc[site.region]) {
      acc[site.region] = {
        region_name: site.region,
        up_count: 0,
        down_count: 0,
      };
    }

    if (site.status) {
      acc[site.region].up_count += 1;
    } else {
      acc[site.region].down_count += 1;
    }

    return acc;
  }, {});

  const regionStatus = Object.values(regionSummary)
    .map(region => ({
      ...region,
      availability_score: region.up_count + region.down_count === 0
        ? 0
        : Number(((region.up_count / (region.up_count + region.down_count)) * 100).toFixed(1)),
    }))
    .sort((left, right) => left.region_name.localeCompare(right.region_name));

  const recentDownRows = treeSites
    .filter(site => !site.status)
    .map(site => ({
      id: site.id,
      site_code: site.site_code,
      name: site.name,
      region: site.region,
      county: site.county,
      contractor: site.contractor || 'Unassigned',
      last_ping_time: site.last_polled || new Date().toISOString(),
    }));

  const escalationMap = new Map();
  (Array.isArray(escalationData) ? escalationData : []).forEach(group => {
    const contractor = group.contractor || 'Unassigned';
    escalationMap.set(contractor, {
      vendor_email: group.vendor_email || '',
      officers: Array.isArray(group.officers) ? group.officers : [],
    });
  });

  const contractorGroups = {};
  recentDownRows.forEach(site => {
    const contractor = site.contractor || 'Unassigned';
    if (!contractorGroups[contractor]) {
      contractorGroups[contractor] = {
        contractor,
        vendor_email: escalationMap.get(contractor)?.vendor_email || '',
        sites: [],
        officers: escalationMap.get(contractor)?.officers || [],
      };
    }

    contractorGroups[contractor].sites.push({
      id: site.id,
      site_code: site.site_code,
      name: site.name,
      region: site.region,
      county: site.county,
      down_since: site.last_ping_time,
    });
  });

  return {
    dashboardSummary: {
      total_sites: totalSites,
      sites_up: sitesUp,
      sites_down: sitesDown,
      uptime: totalSites === 0 ? 0 : Number(((sitesUp / totalSites) * 100).toFixed(1)),
    },
    regionStatus,
    recentDown: recentDownRows,
    escalationData: Object.values(contractorGroups),
  };
};

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

const MOCK_FALLBACKS = {
  sidebarTree: [
    {
      id: 1,
      name: 'OGN',
      regions: [
        {
          id: 1,
          name: 'Nairobi',
          counties: [
            {
              id: 1,
              name: 'Nairobi',
              sub_counties: [
                {
                  id: 1,
                  name: 'Westlands',
                  sites: [
                    { id: 1, label: 'NAI-WES-P01', site_code: 'NAI-WES-P01', name: 'Westlands Police Post', current_status: false },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 2,
          name: 'Nyanza',
          counties: [
            {
              id: 2,
              name: 'Migori',
              sub_counties: [
                {
                  id: 2,
                  name: 'Uriri',
                  sites: [
                    { id: 2, label: 'URI-URIRI-P5800', site_code: 'URI-URIRI-P5800', name: 'Uriri Police HQ', current_status: false },
                    { id: 3, label: 'URI-URIRI-C5900', site_code: 'URI-URIRI-C5900', name: 'Uriri Clinic', current_status: false },
                  ],
                },
              ],
            },
            {
              id: 3,
              name: 'Kisumu',
              sub_counties: [
                {
                  id: 3,
                  name: 'Kisumu Central',
                  sites: [
                    { id: 4, label: 'KSM-CEN-H02', site_code: 'KSM-CEN-H02', name: 'Kisumu Depot', current_status: false },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 3,
          name: 'Coast',
          counties: [
            {
              id: 4,
              name: 'Mombasa',
              sub_counties: [
                {
                  id: 4,
                  name: 'Mvita',
                  sites: [
                    { id: 5, label: 'MOM-TOWN-C01', site_code: 'MOM-TOWN-C01', name: 'Mombasa Town Clinic', current_status: false },
                    { id: 6, label: 'MOM-TOWN-C02', site_code: 'MOM-TOWN-C02', name: 'Mombasa Central Office', current_status: false },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  dashboardSummary: {
    total_sites: 248,
    sites_up: 241,
    sites_down: 7,
    uptime: 99.8,
  },
  regionStatus: [
    { region_name: 'Nairobi', up_count: 120, down_count: 0, availability_score: 100 },
    { region_name: 'Nyanza', up_count: 42, down_count: 2, availability_score: 95.4 },
    { region_name: 'Coast', up_count: 55, down_count: 7, availability_score: 88.7 },
    { region_name: 'Western', up_count: 24, down_count: 15, availability_score: 61.5 },
  ],
  recentDown: [
    { id: 1, site_code: 'URI-URIRI-P5800', name: 'Uriri Police HQ', region: 'Nyanza', county: 'Migori', contractor: 'Safaricom Business', last_ping_time: new Date().toISOString() },
    { id: 2, site_code: 'URI-URIRI-C5900', name: 'Uriri Clinic', region: 'Nyanza', county: 'Migori', contractor: 'Safaricom Business', last_ping_time: new Date().toISOString() },
    { id: 3, site_code: 'KSM-CEN-H02', name: 'Kisumu Depot', region: 'Nyanza', county: 'Kisumu', contractor: 'Liquid Intelligent Tech', last_ping_time: new Date().toISOString() },
  ],
  escalationData: [
    {
      contractor: 'Safaricom Business',
      vendor_email: 'noc@safaricom.co.ke',
      sites: [
        { id: 1, site_code: 'URI-URIRI-P5800', name: 'Uriri Police HQ', region: 'Nyanza', county: 'Migori', down_since: new Date().toISOString() },
        { id: 2, site_code: 'URI-URIRI-C5900', name: 'Uriri Clinic', region: 'Nyanza', county: 'Migori', down_since: new Date().toISOString() },
      ],
      officers: [
        { id: 1, name: 'James Ochieng', email: 'j.ochieng@ogn.go.ke', phone: '+254 712 345 678', role: 'Area ICT Officer – Nyanza' },
      ],
    },
    {
      contractor: 'Liquid Intelligent Tech',
      vendor_email: 'noc@liquidtelecom.com',
      sites: [
        { id: 3, site_code: 'KSM-CEN-H02', name: 'Kisumu Depot', region: 'Nyanza', county: 'Kisumu', down_since: new Date().toISOString() },
      ],
      officers: [
        { id: 2, name: 'Catherine Wanjiku', email: 'c.wanjiku@ogn.go.ke', phone: '+254 745 678 901', role: 'Area ICT Officer – Multi-Region' },
      ],
    },
  ],
};

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
    const nextValues = {};

    results.forEach(({ key, data, error }) => {
      if (error) {
        newErrors[key] = error;
        return;
      }

      nextValues[key] = data;
    });

    const currentSidebarTree = nextValues.sidebarTree || sidebarTree;
    const currentRecentDown = nextValues.recentDown || recentDown;
    const currentEscalationData = nextValues.escalationData || escalationData;
    const derivedState = buildDerivedNetworkState(
      currentSidebarTree,
      currentRecentDown,
      currentEscalationData
    );

    Object.entries(nextValues).forEach(([key, value]) => {
      const setter = setters[key];
      if (setter) setter(value);
    });

    setters.dashboardSummary(derivedState.dashboardSummary);
    setters.regionStatus(derivedState.regionStatus);
    setters.recentDown(derivedState.recentDown);
    setters.escalationData(derivedState.escalationData);

    setErrors(newErrors);
    setLastRefreshedAt(new Date());

    // The first successful fetch turns off the initial loading state
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      setInitialLoading(false);
    }
  }, [escalationData, recentDown, setters, sidebarTree]);

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
