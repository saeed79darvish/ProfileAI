import React from 'react';
import styled from 'styled-components';
import {
  CloudUpload as ImportIcon,
  LinkedIn as LinkedInIcon,
  Email as EmailIcon,
  Description as CsvIcon,
  Person as ManualIcon,
  Share as ReferralIcon,
  Api as ApiIcon,
  Business as AtsIcon
} from '@mui/icons-material';
import { Tooltip } from '@mui/material';

// Badge container
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  
  svg {
    font-size: 14px;
  }
  
  ${props => {
    switch (props.$source) {
      case 'csv':
        return `
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
        `;
      case 'linkedin':
        return `
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1e40af;
        `;
      case 'email':
        return `
          background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
          color: #9d174d;
        `;
      case 'ats':
        return `
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #4338ca;
        `;
      case 'api':
        return `
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #047857;
        `;
      case 'referral':
        return `
          background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%);
          color: #a16207;
        `;
      case 'manual':
      default:
        return `
          background: #f1f5f9;
          color: #475569;
        `;
    }
  }}
`;

// Small inline badge (for compact views)
const InlineBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  
  svg {
    font-size: 14px;
  }
  
  ${props => {
    switch (props.$source) {
      case 'csv':
        return `
          background: #fef3c7;
          color: #d97706;
        `;
      case 'linkedin':
        return `
          background: #dbeafe;
          color: #0077b5;
        `;
      case 'email':
        return `
          background: #fce7f3;
          color: #ec4899;
        `;
      case 'ats':
        return `
          background: #e0e7ff;
          color: #6366f1;
        `;
      case 'api':
        return `
          background: #d1fae5;
          color: #10b981;
        `;
      case 'referral':
        return `
          background: #fef9c3;
          color: #eab308;
        `;
      default:
        return `
          background: #f1f5f9;
          color: #64748b;
        `;
    }
  }}
`;

const getSourceIcon = (source) => {
  switch (source) {
    case 'csv': return <CsvIcon />;
    case 'linkedin': return <LinkedInIcon />;
    case 'email': return <EmailIcon />;
    case 'ats': return <AtsIcon />;
    case 'api': return <ApiIcon />;
    case 'referral': return <ReferralIcon />;
    case 'manual': return <ManualIcon />;
    default: return <ImportIcon />;
  }
};

const getSourceLabel = (source) => {
  switch (source) {
    case 'csv': return 'CSV Import';
    case 'linkedin': return 'LinkedIn';
    case 'email': return 'Email Import';
    case 'ats': return 'ATS Import';
    case 'api': return 'API Import';
    case 'referral': return 'Referral';
    case 'manual': return 'Applied';
    default: return 'Applied';
  }
};

const getSourceTooltip = (source, importedAt) => {
  const dateStr = importedAt ? new Date(importedAt).toLocaleDateString() : '';
  
  switch (source) {
    case 'csv': return `Imported from CSV file${dateStr ? ` on ${dateStr}` : ''}`;
    case 'linkedin': return `Imported from LinkedIn${dateStr ? ` on ${dateStr}` : ''}`;
    case 'email': return `Imported from email list${dateStr ? ` on ${dateStr}` : ''}`;
    case 'ats': return `Imported from ATS integration${dateStr ? ` on ${dateStr}` : ''}`;
    case 'api': return `Added via API${dateStr ? ` on ${dateStr}` : ''}`;
    case 'referral': return `Added via referral${dateStr ? ` on ${dateStr}` : ''}`;
    case 'manual': return 'Candidate applied directly';
    default: return 'Candidate applied directly';
  }
};

/**
 * SourceBadge Component
 * Displays the source of a candidate import with appropriate styling
 * 
 * @param {Object} props
 * @param {string} props.source - The import source: 'manual', 'csv', 'linkedin', 'email', 'ats', 'api', 'referral'
 * @param {Date} props.importedAt - When the candidate was imported (optional)
 * @param {boolean} props.compact - Show compact inline badge (icon only)
 * @param {boolean} props.showLabel - Show text label (default: true for non-compact)
 */
const SourceBadge = ({ source, importedAt, compact = false, showLabel = true }) => {
  // Don't show badge for manual (direct applications) unless explicitly requested
  if (!source || source === 'manual') {
    return null;
  }
  
  const icon = getSourceIcon(source);
  const label = getSourceLabel(source);
  const tooltip = getSourceTooltip(source, importedAt);
  
  if (compact) {
    return (
      <Tooltip title={tooltip} arrow placement="top">
        <InlineBadge $source={source}>
          {icon}
        </InlineBadge>
      </Tooltip>
    );
  }
  
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Badge $source={source}>
        {icon}
        {showLabel && <span>{label}</span>}
      </Badge>
    </Tooltip>
  );
};

export default SourceBadge;

// Also export utility functions for use elsewhere
export { getSourceIcon, getSourceLabel, getSourceTooltip };
