import React, { useState, useEffect, useCallback } from 'react';
import {
  fadeIn,
  spin,
  PageContainer,
  Header,
  HeaderContent,
  BackButton,
  Title,
  Content,
  Stats,
  StatCard,
  FiltersSection,
  SearchInput,
  FilterButton,
  DownloadTemplateButton,
  ImportsList,
  ImportCard,
  ImportHeader,
  ImportInfo,
  ImportIcon,
  ImportDetails,
  StatusBadge,
  ImportStats,
  ImportStat,
  ImportActions,
  ActionButton,
  EmptyState,
  LoadingSpinner,
  Toast
} from './styled';
import { ROUTES, TEXT, TOAST_DURATION_MS } from './constants';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ImportHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Calculate stats
  const stats = {
    total: imports.length,
    totalCandidates: imports.reduce((sum, imp) => sum + (imp.successfulImports || 0), 0),
    completed: imports.filter(imp => imp.status === 'completed').length,
    processing: imports.filter(imp => imp.status === 'processing').length
  };
  
  const fetchImports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.getImports();
      console.log('[Import History] API Response:', response.data);
      setImports(response.data.data?.imports || response.data.imports || []);
    } catch (error) {
      console.error('Error fetching imports:', error);
      showToast(TEXT.TOAST_LOAD_ERROR, 'error');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchImports();
  }, [fetchImports]);
  
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };
  
  const handleDelete = async (importId) => {
    if (!window.confirm(TEXT.CONFIRM_DELETE)) {
      return;
    }
    
    try {
      setDeleting(importId);
      await candidateAPI.deleteImport(importId);
      setImports(prev => prev.filter(imp => imp.id !== importId));
      showToast(TEXT.TOAST_DELETE_SUCCESS);
    } catch (error) {
      console.error('Error deleting import:', error);
      showToast(TEXT.TOAST_DELETE_ERROR, 'error');
    } finally {
      setDeleting(null);
    }
  };
  
  const handleDownloadTemplate = async () => {
    try {
      const response = await candidateAPI.downloadTemplate();
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = TEXT.TEMPLATE_FILENAME;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showToast(TEXT.TEMPLATE_DOWNLOADED);
    } catch (error) {
      console.error('Error downloading template:', error);
      showToast(TEXT.TOAST_TEMPLATE_ERROR, 'error');
    }
  };
  
  const getImportIcon = (type) => {
    switch (type) {
      case 'csv': return <CsvIcon />;
      case 'linkedin': return <LinkedInIcon />;
      case 'email': return <EmailIcon />;
      default: return <CloudIcon />;
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <SuccessIcon />;
      case 'processing': return <RefreshIcon />;
      case 'failed': return <ErrorIcon />;
      default: return <PendingIcon />;
    }
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Filter imports
  const filteredImports = imports.filter(imp => {
    if (filter !== 'all' && imp.importType !== filter) return false;
    if (searchQuery && !imp.fileName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  return (
    <PageContainer>
      <Header>
        <HeaderContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <BackButton onClick={() => navigate(ROUTES.BACK_TO_JOBS)}>
              <BackIcon /> {TEXT.BACK_TO_JOBS}
            </BackButton>
            <Title>
              <UploadIcon /> {TEXT.PAGE_TITLE}
            </Title>
          </div>
        </HeaderContent>
      </Header>
      
      <Content>
        {/* Stats */}
        <Stats>
          <StatCard $bg="#f0fdf4" $color="#22c55e">
            <div className="icon"><SuccessIcon /></div>
            <div className="content">
              <h3>{stats.totalCandidates}</h3>
              <p>{TEXT.STAT_CANDIDATES}</p>
            </div>
          </StatCard>
          <StatCard $bg="#fef3c7" $color="#f59e0b">
            <div className="icon"><CloudIcon /></div>
            <div className="content">
              <h3>{stats.total}</h3>
              <p>{TEXT.STAT_TOTAL}</p>
            </div>
          </StatCard>
          <StatCard $bg="#dbeafe" $color="#3b82f6">
            <div className="icon"><SuccessIcon /></div>
            <div className="content">
              <h3>{stats.completed}</h3>
              <p>{TEXT.STAT_COMPLETED}</p>
            </div>
          </StatCard>
          <StatCard $bg="#fce7f3" $color="#ec4899">
            <div className="icon"><RefreshIcon /></div>
            <div className="content">
              <h3>{stats.processing}</h3>
              <p>{TEXT.STAT_PROCESSING}</p>
            </div>
          </StatCard>
        </Stats>
        
        {/* Filters */}
        <FiltersSection>
          <SearchInput>
            <SearchIcon />
            <input 
              type="text"
              placeholder="Search imports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchInput>
          
          <FilterButton $active={filter === 'all'} onClick={() => setFilter('all')}>
            <FilterIcon /> {TEXT.FILTER_ALL}
          </FilterButton>
          <FilterButton $active={filter === 'csv'} onClick={() => setFilter('csv')}>
            <CsvIcon /> {TEXT.FILTER_CSV}
          </FilterButton>
          <FilterButton $active={filter === 'linkedin'} onClick={() => setFilter('linkedin')}>
            <LinkedInIcon /> {TEXT.FILTER_LINKEDIN}
          </FilterButton>
          <FilterButton $active={filter === 'email'} onClick={() => setFilter('email')}>
            <EmailIcon /> {TEXT.FILTER_EMAIL}
          </FilterButton>
          
          <DownloadTemplateButton onClick={handleDownloadTemplate}>
            <DownloadIcon /> {TEXT.DOWNLOAD_TEMPLATE}
          </DownloadTemplateButton>
        </FiltersSection>
        
        {/* Imports List */}
        {loading ? (
          <LoadingSpinner>
            <RefreshIcon />
          </LoadingSpinner>
        ) : filteredImports.length === 0 ? (
          <EmptyState>
            <CloudIcon />
            <h3>{TEXT.EMPTY_TITLE}</h3>
            <p>{TEXT.EMPTY_SUBTITLE}</p>
          </EmptyState>
        ) : (
          <ImportsList>
            {filteredImports.map(imp => (
              <ImportCard key={imp.id}>
                <ImportHeader>
                  <ImportInfo>
                    <ImportIcon $type={imp.importType}>
                      {getImportIcon(imp.importType)}
                    </ImportIcon>
                    <ImportDetails>
                      <h3>{imp.fileName || `${imp.importType.toUpperCase()} Import`}</h3>
                      <p>
                        {imp.Job?.title ? `For: ${imp.Job.title}` : TEXT.DIRECT_IMPORT}
                      </p>
                      <div className="meta">
                        <span>{formatDate(imp.createdAt)}</span>
                        <span>•</span>
                        <span>{imp.totalCandidates} candidates</span>
                      </div>
                    </ImportDetails>
                  </ImportInfo>
                  
                  <StatusBadge $status={imp.status}>
                    {getStatusIcon(imp.status)}
                    {imp.status.charAt(0).toUpperCase() + imp.status.slice(1)}
                  </StatusBadge>
                </ImportHeader>
                
                <ImportStats>
                  <ImportStat>
                    <div className="value">{imp.totalCandidates}</div>
                    <div className="label">{TEXT.STAT_TOTAL_LABEL}</div>
                  </ImportStat>
                  <ImportStat $color="#22c55e">
                    <div className="value">{imp.successfulImports || 0}</div>
                    <div className="label">{TEXT.STAT_SUCCESSFUL}</div>
                  </ImportStat>
                  <ImportStat $color="#f59e0b">
                    <div className="value">{imp.duplicatesFound || 0}</div>
                    <div className="label">{TEXT.STAT_DUPLICATES}</div>
                  </ImportStat>
                  <ImportStat $color="#ef4444">
                    <div className="value">{imp.failedImports || 0}</div>
                    <div className="label">{TEXT.STAT_FAILED}</div>
                  </ImportStat>
                </ImportStats>
                
                <ImportActions>
                  {imp.jobId && (
                    <ActionButton onClick={() => navigate(ROUTES.JOB_APPLICATIONS(imp.jobId))}>
                      <ViewIcon /> {TEXT.VIEW_APPLICATIONS}
                    </ActionButton>
                  )}
                  <ActionButton 
                    $variant="danger" 
                    onClick={() => handleDelete(imp.id)}
                    disabled={deleting === imp.id}
                  >
                    <DeleteIcon /> {deleting === imp.id ? TEXT.DELETING : TEXT.DELETE}
                  </ActionButton>
                </ImportActions>
              </ImportCard>
            ))}
          </ImportsList>
        )}
      </Content>
      
      {toast && (
        <Toast $type={toast.type}>{toast.message}</Toast>
      )}
    </PageContainer>
  );
};

export default ImportHistoryPage;
