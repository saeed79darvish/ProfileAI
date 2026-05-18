import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Mail,
  MailOpen,
  MousePointerClick,
  UserCheck,
  UserX,
  Clock,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import { invitationAPI } from '../../services/api';

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
`;

const Modal = styled(motion.div)`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    color: #667eea;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: #64748b;
  border-radius: 8px;
  
  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const StatCard = styled.div`
  background: ${props => props.$bg || '#f8fafc'};
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  
  .icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: ${props => props.$iconBg || 'rgba(102, 126, 234, 0.1)'};
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 8px;
    
    svg {
      width: 18px;
      height: 18px;
      color: ${props => props.$iconColor || '#667eea'};
    }
  }
  
  .value {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
  }
  
  .label {
    font-size: 12px;
    color: #64748b;
    margin-top: 4px;
  }
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 200px;
  
  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    color: #94a3b8;
  }
  
  input {
    width: 100%;
    padding: 10px 12px 10px 40px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    
    &:focus {
      outline: none;
      border-color: #667eea;
    }
  }
`;

const FilterSelect = styled.select`
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    
    &:hover:not(:disabled) {
      background: #f8fafc;
      color: #1e293b;
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHeader = styled.thead`
  background: #f8fafc;
  
  th {
    text-align: left;
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

const TableBody = styled.tbody`
  tr {
    border-bottom: 1px solid #f1f5f9;
    
    &:hover {
      background: #fafafa;
    }
  }
  
  td {
    padding: 12px 16px;
    font-size: 14px;
    color: #1e293b;
  }
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch (props.$status) {
      case 'accepted':
        return 'background: #dcfce7; color: #166534;';
      case 'declined':
        return 'background: #fee2e2; color: #991b1b;';
      case 'clicked':
        return 'background: #dbeafe; color: #1e40af;';
      case 'opened':
        return 'background: #fef3c7; color: #92400e;';
      case 'sent':
      case 'delivered':
        return 'background: #e2e8f0; color: #475569;';
      case 'pending':
        return 'background: #f1f5f9; color: #64748b;';
      case 'expired':
        return 'background: #fecaca; color: #dc2626;';
      default:
        return 'background: #f1f5f9; color: #64748b;';
    }
  }}
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: #64748b;
  
  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  
  svg {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const statusIcons = {
  pending: Clock,
  sent: Send,
  delivered: Mail,
  opened: MailOpen,
  clicked: MousePointerClick,
  accepted: UserCheck,
  declined: UserX,
  expired: AlertCircle
};

const InvitationDashboard = ({ isOpen, onClose, importId, jobTitle }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sendingReminders, setSendingReminders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    if (isOpen && importId) {
      fetchData();
    }
  }, [isOpen, importId]);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, invitationsRes] = await Promise.all([
        invitationAPI.getStats(importId),
        invitationAPI.listInvitations(importId)
      ]);
      setStats(statsRes.data.data);
      setInvitations(invitationsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch invitation data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };
  
  const handleSendReminders = async () => {
    if (!window.confirm('Send reminder emails to candidates who haven\'t responded yet?')) {
      return;
    }
    
    setSendingReminders(true);
    try {
      await invitationAPI.sendReminders(importId);
      await fetchData();
    } catch (error) {
      console.error('Failed to send reminders:', error);
    } finally {
      setSendingReminders(false);
    }
  };
  
  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch = searchQuery === '' || 
      inv.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.firstName && inv.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.lastName && inv.lastName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <Modal
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
        >
          <Header>
            <Title>
              <Mail size={24} />
              Invitation Tracking
              {jobTitle && <span style={{ fontWeight: 400, color: '#64748b' }}>— {jobTitle}</span>}
            </Title>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </Header>
          
          <Content>
            {loading ? (
              <LoadingState>
                <RefreshCw size={32} />
              </LoadingState>
            ) : (
              <>
                {/* Stats Grid */}
                <StatsGrid>
                  <StatCard>
                    <div className="icon"><Send /></div>
                    <div className="value">{stats?.total || 0}</div>
                    <div className="label">Total Sent</div>
                  </StatCard>
                  <StatCard $iconBg="rgba(234, 179, 8, 0.1)" $iconColor="#eab308">
                    <div className="icon"><MailOpen /></div>
                    <div className="value">{stats?.opened || 0}</div>
                    <div className="label">Opened</div>
                  </StatCard>
                  <StatCard $iconBg="rgba(59, 130, 246, 0.1)" $iconColor="#3b82f6">
                    <div className="icon"><MousePointerClick /></div>
                    <div className="value">{stats?.clicked || 0}</div>
                    <div className="label">Clicked</div>
                  </StatCard>
                  <StatCard $iconBg="rgba(34, 197, 94, 0.1)" $iconColor="#22c55e">
                    <div className="icon"><UserCheck /></div>
                    <div className="value">{stats?.accepted || 0}</div>
                    <div className="label">Accepted</div>
                  </StatCard>
                  <StatCard $iconBg="rgba(239, 68, 68, 0.1)" $iconColor="#ef4444">
                    <div className="icon"><UserX /></div>
                    <div className="value">{stats?.declined || 0}</div>
                    <div className="label">Declined</div>
                  </StatCard>
                  <StatCard $iconBg="rgba(148, 163, 184, 0.1)" $iconColor="#94a3b8">
                    <div className="icon"><Clock /></div>
                    <div className="value">{stats?.pending || 0}</div>
                    <div className="label">Pending</div>
                  </StatCard>
                </StatsGrid>
                
                {/* Toolbar */}
                <Toolbar>
                  <SearchWrapper>
                    <Search />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </SearchWrapper>
                  
                  <FilterSelect
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="opened">Opened</option>
                    <option value="clicked">Clicked</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="expired">Expired</option>
                  </FilterSelect>
                  
                  <ActionButton onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={refreshing ? 'spinning' : ''} />
                    Refresh
                  </ActionButton>
                  
                  <ActionButton
                    $primary
                    onClick={handleSendReminders}
                    disabled={sendingReminders || (stats?.pending || 0) === 0}
                  >
                    <Send />
                    {sendingReminders ? 'Sending...' : 'Send Reminders'}
                  </ActionButton>
                </Toolbar>
                
                {/* Table */}
                {filteredInvitations.length === 0 ? (
                  <EmptyState>
                    <Mail />
                    <h3>No invitations found</h3>
                    <p>
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filter'
                        : 'Send invitations to imported candidates to see them here'}
                    </p>
                  </EmptyState>
                ) : (
                  <Table>
                    <TableHeader>
                      <tr>
                        <th>Candidate</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Sent At</th>
                        <th>Response</th>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {filteredInvitations.map(invitation => {
                        const StatusIcon = statusIcons[invitation.status] || Clock;
                        return (
                          <tr key={invitation.id}>
                            <td>
                              {invitation.firstName || invitation.lastName 
                                ? `${invitation.firstName || ''} ${invitation.lastName || ''}`.trim()
                                : '-'}
                            </td>
                            <td>{invitation.email}</td>
                            <td>
                              <StatusBadge $status={invitation.status}>
                                <StatusIcon size={14} />
                                {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                              </StatusBadge>
                            </td>
                            <td>{formatDate(invitation.sentAt)}</td>
                            <td>
                              {invitation.respondedAt 
                                ? formatDate(invitation.respondedAt)
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </Content>
        </Modal>
      </Overlay>
    </AnimatePresence>
  );
};

export default InvitationDashboard;
