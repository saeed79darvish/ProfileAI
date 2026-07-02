import React, { useState, useEffect, useCallback } from 'react';
import {
  fadeIn,
  slideUp,
  PageContainer,
  Header,
  HeaderTop,
  HeaderTitle,
  StatsRow,
  StatPill,
  ToolbarRow,
  SearchBox,
  ViewToggle,
  ViewBtn,
  FilterBtn,
  AddButton,
  KanbanContainer,
  KanbanColumn,
  ColumnHeader,
  ColumnTitle,
  ColumnBody,
  EmptyColumn,
  AppCard,
  CardCompany,
  CompanyAvatar,
  CompanyInfo,
  CardMeta,
  MetaTag,
  CardFooter,
  DateLabel,
  MatchBadge,
  ListView,
  ListRow,
  ListCompany,
  ListMeta,
  ListStatus,
  ListDate,
  ListActions,
  StatusChip,
  EmptyState,
  EmptyIcon,
  EmptyTitle,
  EmptyText,
  CTAButton,
  LoadingContainer,
  ArchiveSection,
  ArchiveToggle,
  ArchiveCards
} from './styled';
import { ROUTES, STATUS_CONFIG, KANBAN_COLUMNS, ARCHIVE_STATUSES, COMPANY_COLORS, TIMINGS, LIMITS, TEXT } from './constants';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (TIMINGS.MS_PER_DAY));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < LIMITS.DAY_THRESHOLD) return `${diffDays}d ago`;
  if (diffDays < LIMITS.WEEK_THRESHOLD) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCompanyInitial(company) {
  return company ? company.charAt(0).toUpperCase() : '?';
}

function getCompanyColor(company) {
  const idx = (company || '').charCodeAt(0) % COMPANY_COLORS.length;
  return COMPANY_COLORS[idx];
}

export default function MyJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchive, setShowArchive] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Dialog states
  const [editDialog, setEditDialog] = useState({ open: false, app: null });
  const [addDialog, setAddDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, app: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, app: null });

  // Context menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuApp, setMenuApp] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [appsRes, statsRes] = await Promise.all([
        externalApplicationAPI.getAll({ search: search || undefined, status: statusFilter }),
        externalApplicationAPI.getStats(),
      ]);
      setApplications(appsRes.data.applications);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setSnack({ open: true, message: 'Failed to load applications', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);
  Object.keys(STATUS_CONFIG).forEach(s => { grouped[s] = []; });
  applications.forEach(app => {
    if (grouped[app.status]) grouped[app.status].push(app);
  });

  const activeApps = applications.filter(a => KANBAN_COLUMNS.includes(a.status));
  const archivedApps = applications.filter(a => ARCHIVE_STATUSES.includes(a.status));

  // ─── Handlers ─────────────────────────────
  const handleStatusChange = async (app, newStatus) => {
    try {
      await externalApplicationAPI.update(app.id, { status: newStatus });
      setSnack({ open: true, message: `Moved to ${STATUS_CONFIG[newStatus].label}`, severity: 'success' });
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: 'Failed to update status', severity: 'error' });
    }
    setMenuAnchor(null);
    setMenuApp(null);
  };

  const handleDelete = async () => {
    if (!deleteDialog.app) return;
    try {
      await externalApplicationAPI.delete(deleteDialog.app.id);
      setSnack({ open: true, message: 'Application removed', severity: 'success' });
      setDeleteDialog({ open: false, app: null });
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: 'Failed to delete', severity: 'error' });
    }
  };

  const handleAddManual = async (formData) => {
    try {
      await externalApplicationAPI.create(formData);
      setSnack({ open: true, message: 'Application added!', severity: 'success' });
      setAddDialog(false);
      fetchData();
    } catch (err) {
      if (err.response?.status === 409) {
        setSnack({ open: true, message: 'Already tracking this application', severity: 'info' });
      } else {
        setSnack({ open: true, message: 'Failed to add application', severity: 'error' });
      }
    }
  };

  const handleEditSave = async (formData) => {
    try {
      await externalApplicationAPI.update(editDialog.app.id, formData);
      setSnack({ open: true, message: 'Application updated', severity: 'success' });
      setEditDialog({ open: false, app: null });
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: 'Failed to update', severity: 'error' });
    }
  };

  // ─── Render Card ──────────────────────────
  const renderCard = (app, index) => {
    const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;
    const companyColors = getCompanyColor(app.company);

    return (
      <AppCard
        key={app.id}
        $accentColor={statusCfg.color}
        $delay={`${index * 0.04}s`}
        onClick={() => setDetailDialog({ open: true, app })}
      >
        <CardCompany>
          <CompanyAvatar $bg={companyColors.bg} $color={companyColors.color}>
            {getCompanyInitial(app.company)}
          </CompanyAvatar>
          <CompanyInfo>
            <div className="name">{app.company}</div>
            <div className="title">{app.jobTitle}</div>
          </CompanyInfo>
        </CardCompany>
        <CardMeta>
          {app.platform && (
            <MetaTag>
              <OpenIcon /> {app.platform}
            </MetaTag>
          )}
          {app.location && (
            <MetaTag>
              <LocationIcon /> {app.location}
            </MetaTag>
          )}
          {app.salary && (
            <MetaTag>
              <MoneyIcon /> {app.salary}
            </MetaTag>
          )}
        </CardMeta>
        <CardFooter>
          <DateLabel>{formatDate(app.appliedAt)}</DateLabel>
          {app.matchScore && <MatchBadge $score={app.matchScore}>{app.matchScore}% match</MatchBadge>}
        </CardFooter>
      </AppCard>
    );
  };

  // ─── Render List Row ──────────────────────
  const renderListRow = (app, index) => {
    const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;
    const companyColors = getCompanyColor(app.company);

    return (
      <ListRow
        key={app.id}
        $delay={`${index * 0.03}s`}
        onClick={() => setDetailDialog({ open: true, app })}
      >
        <ListCompany>
          <CompanyAvatar $bg={companyColors.bg} $color={companyColors.color}>
            {getCompanyInitial(app.company)}
          </CompanyAvatar>
          <div className="details">
            <div className="company">{app.company}</div>
            <div className="title">{app.jobTitle}</div>
          </div>
        </ListCompany>
        <ListMeta>
          {app.platform && <><OpenIcon sx={{ fontSize: '0.85rem' }} /> {app.platform}</>}
        </ListMeta>
        <ListMeta>
          {app.location && <><LocationIcon sx={{ fontSize: '0.85rem' }} /> {app.location}</>}
        </ListMeta>
        <ListStatus>
          <StatusChip $color={statusCfg.color} $bg={statusCfg.bg}>
            {statusCfg.icon} {statusCfg.label}
          </StatusChip>
        </ListStatus>
        <ListDate>{formatDate(app.appliedAt)}</ListDate>
        <ListActions>
          <Tooltip title="Actions">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(e.currentTarget);
                setMenuApp(app);
              }}
            >
              <MoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListActions>
      </ListRow>
    );
  };

  // ─── Empty State ──────────────────────────
  if (!loading && applications.length === 0 && !search && statusFilter === 'all') {
    return (
      <PageContainer>
        <Header>
          <HeaderTitle>
            <h1><WorkIcon /> My Jobs</h1>
            <p>Track every job you've applied to</p>
          </HeaderTitle>
        </Header>
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          <EmptyTitle>No applications yet</EmptyTitle>
          <EmptyText>
            Install the ApplyPilot Chrome extension and every job you apply to will automatically appear here. 
            You can also add applications manually.
          </EmptyText>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <CTAButton onClick={() => navigate('/applypilot')}>
              <RocketIcon /> Get ApplyPilot
            </CTAButton>
            <CTAButton
              onClick={() => setAddDialog(true)}
              style={{ background: 'white', color: '#667eea', border: '2px solid #667eea' }}
            >
              <AddIcon /> Add Manually
            </CTAButton>
          </div>
        </EmptyState>
        <AddApplicationDialog open={addDialog} onClose={() => setAddDialog(false)} onSave={handleAddManual} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header>
        <HeaderTop>
          <HeaderTitle>
            <h1><WorkIcon /> My Jobs</h1>
            <p>Track every job you've applied to with ApplyPilot</p>
          </HeaderTitle>
          <StatsRow>
            <StatPill>
              <span className="value">{stats?.total || 0}</span>
              <span className="label">Total</span>
            </StatPill>
            <StatPill>
              <span className="value">{stats?.thisWeek || 0}</span>
              <span className="label">This Week</span>
            </StatPill>
            <StatPill>
              <span className="value">{stats?.byStatus?.interviewing || 0}</span>
              <span className="label">Interviews</span>
            </StatPill>
            <StatPill>
              <span className="value">{stats?.byStatus?.offer || 0}</span>
              <span className="label">Offers</span>
            </StatPill>
            {stats?.avgMatchScore && (
              <StatPill>
                <span className="value">{stats.avgMatchScore}%</span>
                <span className="label">Avg Match</span>
              </StatPill>
            )}
          </StatsRow>
        </HeaderTop>

        <ToolbarRow>
          <SearchBox>
            <SearchIcon />
            <input
              placeholder="Search by company or job title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </SearchBox>
          <ViewToggle>
            <ViewBtn $active={view === 'kanban'} onClick={() => setView('kanban')}>
              <KanbanIcon fontSize="small" /> Board
            </ViewBtn>
            <ViewBtn $active={view === 'list'} onClick={() => setView('list')}>
              <ListIcon fontSize="small" /> List
            </ViewBtn>
          </ViewToggle>
          <FilterBtn $active={statusFilter !== 'all'} onClick={() => setStatusFilter(statusFilter === 'all' ? 'applied' : 'all')}>
            <FilterIcon fontSize="small" />
            {statusFilter !== 'all' ? STATUS_CONFIG[statusFilter]?.label : 'All'}
          </FilterBtn>
          <AddButton onClick={() => setAddDialog(true)}>
            <AddIcon fontSize="small" /> Add
          </AddButton>
        </ToolbarRow>
      </Header>

      {loading ? (
        <LoadingContainer>
          <CircularProgress sx={{ color: '#667eea' }} />
        </LoadingContainer>
      ) : view === 'kanban' ? (
        <>
          <KanbanContainer>
            {KANBAN_COLUMNS.map((status, colIdx) => {
              const cfg = STATUS_CONFIG[status];
              const cards = grouped[status] || [];
              return (
                <KanbanColumn key={status} $delay={`${colIdx * 0.08}s`}>
                  <ColumnHeader>
                    <ColumnTitle $color={cfg.color}>
                      <span className="emoji">{cfg.icon}</span>
                      {cfg.label}
                      <span className="count">{cards.length}</span>
                    </ColumnTitle>
                  </ColumnHeader>
                  <ColumnBody>
                    {cards.length === 0 ? (
                      <EmptyColumn>
                        <span className="emoji">{cfg.icon}</span>
                        No {cfg.label.toLowerCase()} applications
                      </EmptyColumn>
                    ) : (
                      cards.map((app, i) => renderCard(app, i))
                    )}
                  </ColumnBody>
                </KanbanColumn>
              );
            })}
          </KanbanContainer>

          {archivedApps.length > 0 && (
            <ArchiveSection>
              <ArchiveToggle $open={showArchive} onClick={() => setShowArchive(!showArchive)}>
                <ArrowDownIcon /> Archived ({archivedApps.length}), Rejected, Withdrawn, No Response
              </ArchiveToggle>
              <ArchiveCards $open={showArchive}>
                {archivedApps.map((app, i) => renderCard(app, i))}
              </ArchiveCards>
            </ArchiveSection>
          )}
        </>
      ) : (
        <ListView>
          {applications.map((app, i) => renderListRow(app, i))}
        </ListView>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); setMenuApp(null); }}
        PaperProps={{
          sx: { borderRadius: '12px', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
        }}
      >
        <MenuItem sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }} disabled>
          Move to...
        </MenuItem>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          menuApp?.status !== key && (
            <MenuItem
              key={key}
              onClick={() => handleStatusChange(menuApp, key)}
              sx={{ fontSize: '0.85rem', gap: 1 }}
            >
              {cfg.icon} {cfg.label}
            </MenuItem>
          )
        ))}
        <MenuItem
          onClick={() => {
            setEditDialog({ open: true, app: menuApp });
            setMenuAnchor(null);
            setMenuApp(null);
          }}
          sx={{ fontSize: '0.85rem', gap: 1 }}
        >
          <EditIcon fontSize="small" /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog({ open: true, app: menuApp });
            setMenuAnchor(null);
            setMenuApp(null);
          }}
          sx={{ fontSize: '0.85rem', gap: 1, color: '#ef4444' }}
        >
          <DeleteIcon fontSize="small" /> Delete
        </MenuItem>
      </Menu>

      {/* Detail Dialog */}
      <ApplicationDetailDialog
        open={detailDialog.open}
        app={detailDialog.app}
        onClose={() => setDetailDialog({ open: false, app: null })}
        onStatusChange={(status) => handleStatusChange(detailDialog.app, status)}
        onEdit={() => {
          setEditDialog({ open: true, app: detailDialog.app });
          setDetailDialog({ open: false, app: null });
        }}
        onDelete={() => {
          setDeleteDialog({ open: true, app: detailDialog.app });
          setDetailDialog({ open: false, app: null });
        }}
      />

      {/* Add Dialog */}
      <AddApplicationDialog
        open={addDialog}
        onClose={() => setAddDialog(false)}
        onSave={handleAddManual}
      />

      {/* Edit Dialog */}
      <EditApplicationDialog
        open={editDialog.open}
        app={editDialog.app}
        onClose={() => setEditDialog({ open: false, app: null })}
        onSave={handleEditSave}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, app: null })}
        PaperProps={{ sx: { borderRadius: '16px', maxWidth: 400 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Application?</DialogTitle>
        <DialogContent>
          <p style={{ color: '#64748b', margin: 0 }}>
            Remove <strong>{deleteDialog.app?.jobTitle}</strong> at{' '}
            <strong>{deleteDialog.app?.company}</strong> from your tracker? This can't be undone.
          </p>
        </DialogContent>
        <DialogActions sx={{ padding: '12px 24px 16px' }}>
          <Button onClick={() => setDeleteDialog({ open: false, app: null })} sx={{ borderRadius: '10px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            sx={{ borderRadius: '10px' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack({ ...snack, open: false })}
          sx={{ borderRadius: '10px' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}

// ─── Application Detail Dialog ───────────────
function ApplicationDetailDialog({ open, app, onClose, onStatusChange, onEdit, onDelete }) {
  if (!app) return null;
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <CompanyAvatar
            $bg={getCompanyColor(app.company).bg}
            $color={getCompanyColor(app.company).color}
            style={{ width: 42, height: 42, fontSize: '1.1rem' }}
          >
            {getCompanyInitial(app.company)}
          </CompanyAvatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{app.jobTitle}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{app.company}</div>
          </div>
        </div>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatusChip $color={statusCfg.color} $bg={statusCfg.bg}>
            {statusCfg.icon} {statusCfg.label}
          </StatusChip>
          {app.matchScore && <MatchBadge $score={app.matchScore}>{app.matchScore}% match</MatchBadge>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 16 }}>
          {app.platform && (
            <DetailItem icon={<OpenIcon />} label="Platform" value={app.platform} />
          )}
          {app.location && (
            <DetailItem icon={<LocationIcon />} label="Location" value={app.location} />
          )}
          {app.salary && (
            <DetailItem icon={<MoneyIcon />} label="Salary" value={app.salary} />
          )}
          {app.jobType && (
            <DetailItem icon={<WorkIcon />} label="Type" value={app.jobType} />
          )}
          {app.locationType && (
            <DetailItem icon={<CompanyIcon />} label="Work Style" value={app.locationType} />
          )}
          <DetailItem icon={<CalendarIcon />} label="Applied" value={formatDate(app.appliedAt)} />
        </div>

        {app.jobUrl && (
          <a
            href={app.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#667eea',
              fontSize: '0.85rem',
              marginBottom: 16,
              textDecoration: 'none',
            }}
          >
            <OpenIcon fontSize="small" /> View original posting
          </a>
        )}

        {app.notes && (
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: '0.85rem',
              color: '#475569',
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <NoteIcon fontSize="small" /> Notes
            </div>
            {app.notes}
          </div>
        )}

        {/* Status change buttons */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>
            MOVE TO
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) =>
              key !== app.status ? (
                <Chip
                  key={key}
                  label={`${cfg.icon} ${cfg.label}`}
                  size="small"
                  onClick={() => { onStatusChange(key); onClose(); }}
                  sx={{
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    '&:hover': { background: cfg.bg },
                  }}
                />
              ) : null
            )}
          </div>
        </div>
      </DialogContent>
      <DialogActions sx={{ padding: '8px 24px 16px', gap: 1 }}>
        <Button
          startIcon={<EditIcon />}
          onClick={onEdit}
          sx={{ borderRadius: '10px', textTransform: 'none' }}
        >
          Edit
        </Button>
        <Button
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          color="error"
          sx={{ borderRadius: '10px', textTransform: 'none' }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ color: '#94a3b8', marginTop: 2 }}>{React.cloneElement(icon, { fontSize: 'small' })}</span>
      <div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Add Application Dialog ─────────────────
function AddApplicationDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    jobTitle: '',
    company: '',
    location: '',
    jobUrl: '',
    platform: '',
    salary: '',
    jobType: '',
    locationType: '',
    notes: '',
  });

  const handleSubmit = () => {
    if (!form.jobTitle.trim() || !form.company.trim()) return;
    onSave(form);
    setForm({ jobTitle: '', company: '', location: '', jobUrl: '', platform: '', salary: '', jobType: '', locationType: '', notes: '' });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Add Application
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          label="Job Title *"
          value={form.jobTitle}
          onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
          size="small"
          fullWidth
        />
        <TextField
          label="Company *"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          size="small"
          fullWidth
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextField
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            size="small"
          />
          <TextField
            label="Platform"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            size="small"
            placeholder="LinkedIn, Indeed..."
          />
        </div>
        <TextField
          label="Job URL"
          value={form.jobUrl}
          onChange={(e) => setForm({ ...form, jobUrl: e.target.value })}
          size="small"
          fullWidth
          placeholder="https://..."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextField
            label="Salary"
            value={form.salary}
            onChange={(e) => setForm({ ...form, salary: e.target.value })}
            size="small"
            placeholder="$80k-$100k"
          />
          <FormControl size="small">
            <InputLabel>Job Type</InputLabel>
            <Select
              value={form.jobType}
              label="Job Type"
              onChange={(e) => setForm({ ...form, jobType: e.target.value })}
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="full-time">Full-time</MenuItem>
              <MenuItem value="part-time">Part-time</MenuItem>
              <MenuItem value="contract">Contract</MenuItem>
              <MenuItem value="internship">Internship</MenuItem>
            </Select>
          </FormControl>
        </div>
        <FormControl size="small">
          <InputLabel>Work Style</InputLabel>
          <Select
            value={form.locationType}
            label="Work Style"
            onChange={(e) => setForm({ ...form, locationType: e.target.value })}
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="remote">Remote</MenuItem>
            <MenuItem value="hybrid">Hybrid</MenuItem>
            <MenuItem value="onsite">On-site</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          size="small"
          fullWidth
          multiline
          rows={2}
          placeholder="Any notes about this application..."
        />
      </DialogContent>
      <DialogActions sx={{ padding: '8px 24px 16px' }}>
        <Button onClick={onClose} sx={{ borderRadius: '10px' }}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!form.jobTitle.trim() || !form.company.trim()}
          sx={{
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #5a71d4 0%, #6a4392 100%)' },
          }}
        >
          Add Application
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Edit Application Dialog ────────────────
function EditApplicationDialog({ open, app, onClose, onSave }) {
  const [form, setForm] = useState({
    status: '',
    jobTitle: '',
    company: '',
    location: '',
    salary: '',
    jobType: '',
    locationType: '',
    notes: '',
  });

  useEffect(() => {
    if (app) {
      setForm({
        status: app.status || 'applied',
        jobTitle: app.jobTitle || '',
        company: app.company || '',
        location: app.location || '',
        salary: app.salary || '',
        jobType: app.jobType || '',
        locationType: app.locationType || '',
        notes: app.notes || '',
      });
    }
  }, [app]);

  const handleSubmit = () => {
    onSave(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Edit Application
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            value={form.status}
            label="Status"
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <MenuItem key={key} value={key}>
                {cfg.icon} {cfg.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Job Title"
          value={form.jobTitle}
          onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
          size="small"
          fullWidth
        />
        <TextField
          label="Company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          size="small"
          fullWidth
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextField
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            size="small"
          />
          <TextField
            label="Salary"
            value={form.salary}
            onChange={(e) => setForm({ ...form, salary: e.target.value })}
            size="small"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormControl size="small">
            <InputLabel>Job Type</InputLabel>
            <Select
              value={form.jobType}
              label="Job Type"
              onChange={(e) => setForm({ ...form, jobType: e.target.value })}
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="full-time">Full-time</MenuItem>
              <MenuItem value="part-time">Part-time</MenuItem>
              <MenuItem value="contract">Contract</MenuItem>
              <MenuItem value="internship">Internship</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Work Style</InputLabel>
            <Select
              value={form.locationType}
              label="Work Style"
              onChange={(e) => setForm({ ...form, locationType: e.target.value })}
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="remote">Remote</MenuItem>
              <MenuItem value="hybrid">Hybrid</MenuItem>
              <MenuItem value="onsite">On-site</MenuItem>
            </Select>
          </FormControl>
        </div>
        <TextField
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          size="small"
          fullWidth
          multiline
          rows={3}
        />
      </DialogContent>
      <DialogActions sx={{ padding: '8px 24px 16px' }}>
        <Button onClick={onClose} sx={{ borderRadius: '10px' }}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          sx={{
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
