import React, { useState } from 'react';
import { useSidebarData } from '../hooks/useNetworkData';
import './SidebarTree.css';

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
  
  // Recursively determine children based on the OGN structure.
  const getChildren = (n) => {
    if (n.regions) return n.regions;
    if (n.counties) return n.counties;
    if (n.sub_counties) return n.sub_counties;
    if (n.sites) return n.sites;
    return null;
  };
  
  const children = getChildren(node);
  const hasChildren = children && children.length > 0;
  
  // Display name correctly maps 'site_code' as 'label' for leaf nodes, falling back to 'name' for parents
  const displayName = node.label || node.name;
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

  return (
    <div className="sidebar-tree-container">
      <div className="sidebar-header">
        <h2>OGN Network</h2>
        <div className="pulse-indicator"></div>
      </div>
      
      <div className="sidebar-tree-content">
        {initialLoading ? (
          <div className="loading-skeleton">
            <div className="skeleton-bar" style={{ width: '80%' }}></div>
            <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
            <div className="skeleton-bar" style={{ width: '60%', marginLeft: '1.25rem' }}></div>
            <div className="skeleton-bar" style={{ width: '40%', marginLeft: '2.5rem' }}></div>
          </div>
        ) : (
          sidebarTree.map(network => (
            <TreeNode key={network.id} node={network} level={0} />
          ))
        )}
      </div>
    </div>
  );
};

export default SidebarTree;
