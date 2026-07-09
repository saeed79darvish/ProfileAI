import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ContactSupport as SupportIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { supportAPI } from '@/services/api';
import { COLORS, GRADIENTS } from '@/designTokens';

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS = {
  open: { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1e40af' },
  resolved: { bg: '#dcfce7', color: '#166534' },
  closed: { bg: '#f3f4f6', color: '#4b5563' },
};

const CATEGORY_LABELS = {
  bug: 'Bug',
  feature: 'Feature',
  billing: 'Billing',
  account: 'Account',
  question: 'Question',
  other: 'Other',
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

const StatusChip = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.open;
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status] || status}
      sx={{
        background: c.bg,
        color: c.color,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 0.3,
        height: 22,
      }}
    />
  );
};

const AdminSupport = () => {
  // ─── List state ───────────────────────────────────────────────────
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({ open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ─── Detail state ─────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // ─── Reply composer state ─────────────────────────────────────────
  const [replyBody, setReplyBody] = useState('');
  const [replyStatus, setReplyStatus] = useState(''); // '' = don't change
  const [replySubmitting, setReplySubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const { data } = await supportAPI.admin.listTickets({
        status: statusFilter,
        category: categoryFilter,
        search: search || undefined,
      });
      setTickets(data.tickets || []);
      setCounts(data.countsByStatus || {});
    } catch (err) {
      setListError(err?.response?.data?.error || 'Could not load tickets.');
    } finally {
      setListLoading(false);
    }
  }, [statusFilter, categoryFilter, search]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const loadTicket = useCallback(async (id) => {
    setDetailLoading(true);
    setDetailError('');
    setTicket(null);
    try {
      const { data } = await supportAPI.admin.getTicket(id);
      setTicket(data.ticket);
      setReplyBody('');
      setReplyStatus('');
    } catch (err) {
      setDetailError(err?.response?.data?.error || 'Could not load ticket.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadTicket(selectedId);
  }, [selectedId, loadTicket]);

  const handleReply = async () => {
    if (!replyBody.trim() || replySubmitting || !ticket) return;
    setReplySubmitting(true);
    try {
      const { data } = await supportAPI.admin.reply(
        ticket.id,
        replyBody.trim(),
        replyStatus || undefined
      );
      setTicket(data.ticket);
      setReplyBody('');
      setReplyStatus('');
      // Refresh list counts / list itself since status likely changed.
      loadTickets();
    } catch (err) {
      setDetailError(err?.response?.data?.error || 'Could not send reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!ticket) return;
    try {
      const { data } = await supportAPI.admin.update(ticket.id, { status: newStatus });
      setTicket(data.ticket);
      loadTickets();
    } catch (err) {
      setDetailError(err?.response?.data?.error || 'Could not update status.');
    }
  };

  const statusChips = useMemo(() => (
    ['open', 'in_progress', 'resolved', 'closed', 'all'].map((s) => ({
      value: s,
      label: s === 'all' ? 'All' : STATUS_LABELS[s],
      count: s === 'all' ? undefined : (counts[s] || 0),
    }))
  ), [counts]);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: GRADIENTS.PRIMARY,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SupportIcon />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.TEXT_PRIMARY, lineHeight: 1.2 }}>
            Support inbox
          </Typography>
          <Typography sx={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>
            Tickets from the Help Center
          </Typography>
        </Box>
        <IconButton onClick={loadTickets} disabled={listLoading} aria-label="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: '12px', border: `1px solid ${COLORS.BORDER_LIGHT}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {statusChips.map((c) => (
              <Chip
                key={c.value}
                clickable
                onClick={() => setStatusFilter(c.value)}
                label={
                  c.count !== undefined ? (
                    <Badge
                      badgeContent={c.count}
                      color="primary"
                      sx={{
                        '& .MuiBadge-badge': {
                          right: -14,
                          top: 2,
                          background: statusFilter === c.value ? 'white' : COLORS.PRIMARY,
                          color: statusFilter === c.value ? COLORS.PRIMARY : 'white',
                          fontWeight: 700,
                        },
                      }}
                    >
                      <span style={{ paddingRight: 8 }}>{c.label}</span>
                    </Badge>
                  ) : c.label
                }
                sx={{
                  background: statusFilter === c.value ? GRADIENTS.PRIMARY : COLORS.BG_LIGHT,
                  color: statusFilter === c.value ? 'white' : COLORS.TEXT_PRIMARY,
                  fontWeight: 600,
                  borderRadius: '999px',
                  '&:hover': {
                    background: statusFilter === c.value ? GRADIENTS.PRIMARY : COLORS.BORDER_LIGHT,
                  },
                }}
              />
            ))}
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Select
            size="small"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            sx={{ minWidth: 140, background: COLORS.BG_WHITE }}
          >
            <MenuItem value="all">All categories</MenuItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <MenuItem key={v} value={v}>{l}</MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            placeholder="Search subject, email\u2026"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: '100%', md: 240 } }}
          />
        </Stack>
      </Paper>

      {/* Split view: list left / detail right on desktop; list-only or detail-only on mobile */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '360px 1fr' },
        }}
      >
        {/* Ticket list */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: `1px solid ${COLORS.BORDER_LIGHT}`,
            overflow: 'hidden',
            display: { xs: selectedId ? 'none' : 'block', md: 'block' },
            maxHeight: { md: 'calc(100vh - 260px)' },
            overflowY: 'auto',
          }}
        >
          {listError && (
            <Alert severity="error" sx={{ m: 2, borderRadius: '10px' }}>{listError}</Alert>
          )}
          {listLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : tickets.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>
              No tickets match those filters.
            </Box>
          ) : (
            tickets.map((t) => (
              <Box
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(t.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(t.id); }}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${COLORS.BORDER_LIGHT}`,
                  background: selectedId === t.id ? 'rgba(102,126,234,0.06)' : 'transparent',
                  '&:hover': { background: 'rgba(102,126,234,0.04)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <StatusChip status={t.status} />
                  <Chip
                    size="small"
                    label={CATEGORY_LABELS[t.category] || t.category}
                    sx={{ background: COLORS.BG_LIGHT, fontSize: 11, height: 22 }}
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography sx={{ fontSize: 11, color: COLORS.TEXT_MUTED }}>
                    {fmtDate(t.createdAt)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: COLORS.TEXT_PRIMARY, mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject}
                </Typography>
                <Typography sx={{ fontSize: 12, color: COLORS.TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name ? `${t.name} \u2022 ` : ''}{t.email}
                </Typography>
              </Box>
            ))
          )}
        </Paper>

        {/* Ticket detail */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: `1px solid ${COLORS.BORDER_LIGHT}`,
            minHeight: 400,
            display: { xs: selectedId ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
          }}
        >
          {!selectedId ? (
            <Box sx={{ p: 4, textAlign: 'center', color: COLORS.TEXT_SECONDARY, fontSize: 14, m: 'auto' }}>
              Select a ticket to view details.
            </Box>
          ) : detailLoading ? (
            <Box sx={{ p: 4, textAlign: 'center', m: 'auto' }}><CircularProgress size={24} /></Box>
          ) : detailError ? (
            <Alert severity="error" sx={{ m: 2, borderRadius: '10px' }}>{detailError}</Alert>
          ) : ticket ? (
            <>
              <Box sx={{ p: { xs: 2, md: 3 }, borderBottom: `1px solid ${COLORS.BORDER_LIGHT}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                  <IconButton
                    size="small"
                    onClick={() => setSelectedId(null)}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                    aria-label="Back to list"
                  >
                    <BackIcon />
                  </IconButton>
                  <StatusChip status={ticket.status} />
                  <Chip
                    size="small"
                    label={CATEGORY_LABELS[ticket.category] || ticket.category}
                    sx={{ background: COLORS.BG_LIGHT, fontSize: 11, height: 22 }}
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Select
                    size="small"
                    value={ticket.status}
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                    sx={{ minWidth: 140, background: COLORS.BG_WHITE }}
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <MenuItem key={v} value={v}>Mark {l}</MenuItem>
                    ))}
                  </Select>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.TEXT_PRIMARY, lineHeight: 1.3, mb: 0.5 }}>
                  {ticket.subject}
                </Typography>
                <Typography sx={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>
                  From <b>{ticket.name || 'Anonymous'}</b> &lt;{ticket.email}&gt; \u2022 {fmtDate(ticket.createdAt)}
                </Typography>
              </Box>

              <Box sx={{ p: { xs: 2, md: 3 }, flexGrow: 1, overflowY: 'auto' }}>
                {/* Original message */}
                <MessageBubble
                  author={ticket.name || ticket.email}
                  role="user"
                  createdAt={ticket.createdAt}
                  body={ticket.message}
                />

                {/* Reply thread */}
                {(ticket.replies || []).map((r, i) => (
                  <MessageBubble
                    key={i}
                    author={r.adminName || (r.by === 'admin' ? 'Support' : 'User')}
                    role={r.by}
                    createdAt={r.createdAt}
                    body={r.body}
                  />
                ))}

                {/* Optional AI chat transcript */}
                {ticket.chatTranscript?.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }}>
                      <Typography sx={{ fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        AI chat before ticket
                      </Typography>
                    </Divider>
                    <Box sx={{ background: COLORS.BG_LIGHT, borderRadius: '10px', p: 2, fontSize: 13 }}>
                      {ticket.chatTranscript.map((m, i) => (
                        <Box key={i} sx={{ mb: 1.25 }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: m.role === 'user' ? COLORS.PRIMARY : COLORS.ACCENT_PURPLE, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {m.role}
                          </Typography>
                          <Typography sx={{ whiteSpace: 'pre-wrap', color: COLORS.TEXT_PRIMARY, fontSize: 13 }}>
                            {m.content}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}
              </Box>

              {/* Reply composer */}
              <Box sx={{ p: { xs: 2, md: 3 }, borderTop: `1px solid ${COLORS.BORDER_LIGHT}`, background: COLORS.BG_LIGHT }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={10}
                  placeholder={`Reply to ${ticket.name || ticket.email}\u2026`}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  disabled={replySubmitting}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', background: 'white' } }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.5, alignItems: { sm: 'center' } }}>
                  <Select
                    size="small"
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    displayEmpty
                    sx={{ minWidth: 180, background: 'white' }}
                  >
                    <MenuItem value="">
                      <em>Keep status ({STATUS_LABELS[ticket.status]})</em>
                    </MenuItem>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <MenuItem key={v} value={v}>Mark {l} after reply</MenuItem>
                    ))}
                  </Select>
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography sx={{ fontSize: 12, color: COLORS.TEXT_MUTED }}>
                    Emails <b>{ticket.email}</b>
                  </Typography>
                  <Button
                    onClick={handleReply}
                    variant="contained"
                    disabled={replySubmitting || !replyBody.trim()}
                    startIcon={replySubmitting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SendIcon />}
                    sx={{
                      background: GRADIENTS.PRIMARY,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: '10px',
                      px: 3,
                      '&:hover': { background: GRADIENTS.PRIMARY, opacity: 0.9 },
                      '&.Mui-disabled': { background: '#c0c0c0', color: '#fff' },
                    }}
                  >
                    {replySubmitting ? 'Sending\u2026' : 'Send reply'}
                  </Button>
                </Stack>
              </Box>
            </>
          ) : null}
        </Paper>
      </Box>
    </Container>
  );
};

// Message bubble used for the initial ticket + threaded replies.
const MessageBubble = ({ author, role, createdAt, body }) => {
  const isAdmin = role === 'admin';
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: isAdmin ? COLORS.PRIMARY : COLORS.TEXT_PRIMARY }}>
          {author}
        </Typography>
        <Chip
          size="small"
          label={isAdmin ? 'Support' : 'User'}
          sx={{
            height: 18,
            fontSize: 10,
            fontWeight: 700,
            background: isAdmin ? 'rgba(102,126,234,0.12)' : COLORS.BG_LIGHT,
            color: isAdmin ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY,
          }}
        />
        <Typography sx={{ fontSize: 11, color: COLORS.TEXT_MUTED }}>
          {fmtDate(createdAt)}
        </Typography>
      </Box>
      <Box
        sx={{
          background: isAdmin ? 'rgba(102,126,234,0.06)' : COLORS.BG_WHITE,
          border: `1px solid ${isAdmin ? 'rgba(102,126,234,0.2)' : COLORS.BORDER_LIGHT}`,
          borderRadius: '10px',
          p: 1.5,
          fontSize: 14,
          lineHeight: 1.55,
          color: COLORS.TEXT_PRIMARY,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {body}
      </Box>
    </Box>
  );
};

export default AdminSupport;
