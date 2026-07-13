import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSidebarData } from '../hooks/useNetworkData';
import './SidebarTree.css';

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.4"></rect>
    <rect x="14" y="3" width="7" height="4" rx="1.4"></rect>
    <rect x="14" y="10" width="7" height="11" rx="1.4"></rect>
    <rect x="3" y="13" width="7" height="8" rx="1.4"></rect>
  </svg>
);

const ReportsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3h6l5 5v13H8z"></path>
    <path d="M14 3v5h5"></path>
    <path d="M11 13h5"></path>
    <path d="M11 17h5"></path>
    <path d="M8 9h.01"></path>
  </svg>
);

const EscalationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v10"></path>
    <path d="M8 18h8"></path>
    <path d="M10 10h4"></path>
    <path d="M10 14h4"></path>
    <path d="M8 6h8"></path>
    <path d="M5.5 4.5h13"></path>
  </svg>
);

const OGNIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8"></circle>
    <path d="M3 12h18"></path>
    <path d="M12 4c2.4 2.3 3.8 5.1 3.8 8s-1.4 5.7-3.8 8c-2.4-2.3-3.8-5.1-3.8-8s1.4-5.7 3.8-8Z"></path>
  </svg>
);

const OfficerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"></path>
    <path d="M4 20a8 8 0 0 1 16 0"></path>
  </svg>
);

const ContractorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16"></path>
    <path d="M6 7V5h12v2"></path>
    <path d="M7 7v12"></path>
    <path d="M17 7v12"></path>
    <path d="M4 19h16"></path>
  </svg>
);

// SVG Chevron Icon
const ChevronIcon = ({ expanded }) => (
  <svg
    className={`chevron-icon ${expanded ? 'expanded' : ''}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const normaliseSidebarTree = (tree = []) => {
  return tree.map(network => ({
    ...network,
    name: network.name || 'OGN',
    regions: (network.regions || []).map(region => ({
      ...region,
      counties: (region.counties || []).map(county => ({
        ...county,
        sites: (county.sub_counties || []).flatMap(subCounty => (subCounty.sites || []).map(site => ({
          ...site,
          label: site.label || site.site_code,
        }))),
      })),
    })),
  }));
};

// Helper function to recursively count offline sites
const countDownSites = (node) => {
  let count = 0;
  if (node.sites) {
    count += node.sites.filter(site => site.current_status === false).length;
  }
  if (node.regions) node.regions.forEach(child => count += countDownSites(child));
  if (node.counties) node.counties.forEach(child => count += countDownSites(child));
  if (node.sub_counties) node.sub_counties.forEach(child => count += countDownSites(child));
  return count;
};

const TreeNode = ({ node, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getChildren = (n) => {
    if (n.regions) return n.regions;
    if (n.counties) return n.counties;
    if (n.sites) return n.sites;
    return null;
  };

  const children = getChildren(node);
  const hasChildren = children && children.length > 0;
  const displayName = node.label || node.name || 'OGN';
  const isLeaf = !hasChildren;
  const downCount = isLeaf ? 0 : countDownSites(node);

  return (
    <div className={`tree-node level-${level}`}>
      <div
        className={`node-content ${isLeaf ? 'leaf-node' : 'parent-node'}`}
        style={{ paddingLeft: `${level * 1.25}rem` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        <div className="node-icon-wrapper">
          {hasChildren && <ChevronIcon expanded={isExpanded} />}
          {isLeaf && <span className="leaf-dot"></span>}
        </div>

        <div className="node-label-wrapper">
          <span className="node-label">{displayName}</span>
          {isLeaf && (
            <span className={`inline-status-dot ${node.current_status ? 'active' : 'offline'}`}></span>
          )}
        </div>

        {!isLeaf && downCount > 0 && (
          <span className="down-badge">{downCount} down</span>
        )}
      </div>

      {hasChildren && (
        <div className={`node-children-container ${isExpanded ? 'expanded' : ''}`}>
          <div className="node-children-wrapper">
            {children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarTree = () => {
  const { sidebarTree, initialLoading } = useSidebarData();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isOGNOpen, setIsOGNOpen] = useState(false);
  const normalisedTree = useMemo(() => normaliseSidebarTree(sidebarTree), [sidebarTree]);

  const primaryLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/reports', label: 'Reports', icon: <ReportsIcon /> },
    { to: '/ict-officers', label: 'ICT Officers', icon: <OfficerIcon /> },
    { to: '/contractors', label: 'Contractors', icon: <ContractorIcon /> },
    { to: '/escalation', label: 'Escalation', icon: <EscalationIcon /> },
  ];

  return (
    <div className={`sidebar-tree-container ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <button
            className="sidebar-collapse-toggle"
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span>{isCollapsed ? '›' : '‹'}</span>
          </button>
          <h2>OGN Network</h2>
        </div>
        <div className="pulse-indicator"></div>
      </div>

      <div className="sidebar-tree-content">
        <div className="sidebar-nav-group">
          {primaryLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">{link.icon}</span>
              <span className="sidebar-nav-label">{link.label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            className={`sidebar-ogn-toggle ${isOGNOpen ? 'active' : ''}`}
            onClick={() => {
              setIsOGNOpen(!isOGNOpen);
              if (isCollapsed) {
                setIsCollapsed(false);
              }
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true"><OGNIcon /></span>
            <span className="sidebar-nav-label">OGN</span>
          </button>
        </div>

        {isOGNOpen && !isCollapsed && (
          <div className="sidebar-ogn-tree">
            {initialLoading ? (
              <div className="loading-skeleton">
                <div className="skeleton-bar" style={{ width: '80%' }}></div>
                <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
                <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
                <div className="skeleton-bar" style={{ width: '40%', marginLeft: '2.5rem' }}></div>
              </div>
            ) : (
              normalisedTree.map(network => (
                <TreeNode key={network.id} node={network} level={0} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarTree;
