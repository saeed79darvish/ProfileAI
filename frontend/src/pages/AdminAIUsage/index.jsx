import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogContent, DialogTitle,
  Grid, IconButton, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, ToggleButton, ToggleButtonGroup, Typography, Tooltip as MuiTooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { adminAPI } from '@/services/api';
import { COLORS } from '@/designTokens';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'mtd', label: 'This month' },
  { value: 'all', label: 'All time' },
];

const SERIES_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#475569'];

const usd = (n) => {
  const v = Number(n) || 0;
  if (v === 0) return '$0.00';
  if (Math.abs(v) < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = (n) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const tokens = (r) => compact((r.inputTokens || 0) + (r.outputTokens || 0));
const shortDate = (d, bucket) => {
  const date = new Date(d);
  return bucket === 'month'
    ? date.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const Stat = ({ label, value, sub, color }) => (
  <Paper sx={{ p: 2.5, height: '100%' }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h4" fontWeight={700} sx={{ color: color || 'text.primary', my: 0.5 }}>{value}</Typography>
    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
  </Paper>
);

function UsageTable({ title, rows, nameLabel, onRowClick, renderName, empty = 'No calls recorded in this range.' }) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>{title}</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{nameLabel}</TableCell>
              <TableCell align="right">Calls</TableCell>
              <TableCell align="right">Tokens</TableCell>
              <TableCell align="right">Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4}><Typography variant="body2" color="text.secondary">{empty}</Typography></TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.key || r.id} hover={!!onRowClick} onClick={onRowClick ? () => onRowClick(r) : undefined} sx={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                <TableCell>{renderName ? renderName(r) : r.key}</TableCell>
                <TableCell align="right">{r.calls.toLocaleString()}</TableCell>
                <TableCell align="right">{tokens(r)}</TableCell>
                <TableCell align="right"><strong>{usd(r.costUsd)}</strong></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}

function UserDialog({ userId, range, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;
    let live = true;
    setData(null);
    setError(null);
    adminAPI.aiUsageUser(userId, { range })
      .then((res) => live && setData(res.data))
      .catch(() => live && setError('Could not load this user.'));
    return () => { live = false; };
  }, [userId, range]);

  return (
    <Dialog open={!!userId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {data ? (data.user.email) : 'AI usage'}
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
        {data && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Tier: ${data.user.subscriptionTier || 'free'}`} size="small" />
              <Chip label={`Role: ${data.user.role}`} size="small" />
              <Chip label={`${data.totals.calls.toLocaleString()} calls`} size="small" color="primary" variant="outlined" />
              <Chip label={`${compact(data.totals.inputTokens)} in / ${compact(data.totals.outputTokens)} out`} size="small" variant="outlined" />
              <Chip label={`Cost ${usd(data.totals.costUsd)}`} size="small" color="warning" />
              {data.totals.errors > 0 && <Chip label={`${data.totals.errors} failed`} size="small" color="error" variant="outlined" />}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}><UsageTable title="By feature" nameLabel="Feature" rows={data.byFeature} /></Grid>
              <Grid item xs={12} md={6}><UsageTable title="By model" nameLabel="Model" rows={data.byModel} /></Grid>
            </Grid>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Recent calls</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>When</TableCell><TableCell>Feature</TableCell><TableCell>Model</TableCell>
                      <TableCell align="right">In</TableCell><TableCell align="right">Out</TableCell>
                      <TableCell align="right">Cost</TableCell><TableCell align="right">Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recent.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{c.feature || c.route || 'unattributed'}</TableCell>
                        <TableCell>{c.model}{c.status === 'error' && <Chip label="failed" size="small" color="error" sx={{ ml: 1 }} />}</TableCell>
                        <TableCell align="right">{c.inputTokens.toLocaleString()}</TableCell>
                        <TableCell align="right">{c.outputTokens.toLocaleString()}</TableCell>
                        <TableCell align="right">{usd(c.costUsd)}</TableCell>
                        <TableCell align="right">{c.latencyMs != null ? `${(c.latencyMs / 1000).toFixed(1)}s` : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAIUsage() {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [seriesBy, setSeriesBy] = useState('feature');
  const [bucket, setBucket] = useState('day');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('cost');
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState(null);
  const [byModel, setByModel] = useState([]);
  const [byFeature, setByFeature] = useState([]);
  const [users, setUsers] = useState({ users: [], noUser: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openUser, setOpenUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, s, m, f, u] = await Promise.all([
        adminAPI.aiUsageOverview(),
        adminAPI.aiUsageSeries({ range, by: seriesBy, bucket }),
        adminAPI.aiUsageBreakdown({ range, by: 'model' }),
        adminAPI.aiUsageBreakdown({ range, by: 'feature' }),
        adminAPI.aiUsageUsers({ range, sort, search: search || undefined, limit: 100 }),
      ]);
      setOverview(o.data);
      setSeries(s.data);
      setByModel(m.data.rows);
      setByFeature(f.data.rows);
      setUsers(u.data);
    } catch (err) {
      console.error('Failed to load AI usage:', err);
      setError('Could not load AI usage. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [range, seriesBy, bucket, sort, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const exportCsv = async () => {
    const res = await adminAPI.aiUsageExport({ range });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-usage-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chart = useMemo(() => {
    if (!series) return null;
    const labels = [...new Set(series.points.map((p) => p.bucket))].sort();
    const names = [...new Set(series.points.map((p) => p.series || 'Total'))];
    // Largest spenders first, so colours stay stable between ranges.
    const spend = (n) => series.points.filter((p) => (p.series || 'Total') === n).reduce((a, p) => a + p.costUsd, 0);
    names.sort((a, b) => spend(b) - spend(a));
    return {
      labels: labels.map((l) => shortDate(l, series.bucket)),
      datasets: names.map((name, i) => ({
        label: name,
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
        data: labels.map((l) => series.points.find((p) => p.bucket === l && (p.series || 'Total') === name)?.costUsd || 0),
      })),
    };
  }, [series]);

  const month = overview?.month;
  const monthDelta = overview && overview.lastMonth.costUsd > 0
    ? Math.round(((overview.projectedMonthUsd - overview.lastMonth.costUsd) / overview.lastMonth.costUsd) * 100)
    : null;
  const unpriced = (overview?.allTime.unpriced || 0);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/admin')} aria-label="Back to admin dashboard"><BackIcon /></IconButton>
        <AIIcon sx={{ color: COLORS.PRIMARY, fontSize: 32 }} />
        <Typography variant="h4" fontWeight={700} sx={{ flexGrow: 1 }}>AI usage and cost</Typography>
        <MuiTooltip title="Refresh"><IconButton onClick={load} aria-label="Refresh"><RefreshIcon /></IconButton></MuiTooltip>
        <Button startIcon={<DownloadIcon />} onClick={exportCsv} variant="outlined" size="small">Export CSV</Button>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        What we pay Anthropic and OpenAI, by user, feature and model. Cost is computed from the token counts each provider returns.
        {overview?.trackingSince && ` Tracking since ${new Date(overview.trackingSince).toLocaleDateString()}.`}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {unpriced > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {unpriced.toLocaleString()} calls used a model that is not in the price list, so their cost shows as $0.
          Add the model to backend/config/aiPricing.js.
        </Alert>
      )}

      {loading && !overview ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : overview && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={2.4}><Stat label="Today" value={usd(overview.today.costUsd)} sub={`${overview.today.calls.toLocaleString()} calls`} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="This month so far" value={usd(month.costUsd)} sub={`${month.calls.toLocaleString()} calls, ${overview.activeUsersThisMonth} users`} color={COLORS.WARNING} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="Projected this month" value={usd(overview.projectedMonthUsd)} sub={monthDelta == null ? 'No prior month to compare' : `${monthDelta >= 0 ? '+' : ''}${monthDelta}% vs last month`} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="Last month" value={usd(overview.lastMonth.costUsd)} sub={`${overview.lastMonth.calls.toLocaleString()} calls`} /></Grid>
            <Grid item xs={12} md={2.4}><Stat label="All time" value={usd(overview.allTime.costUsd)} sub={`${compact(overview.allTime.inputTokens + overview.allTime.outputTokens)} tokens`} /></Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, v) => v && setRange(v)} aria-label="Date range">
              {RANGES.map((r) => <ToggleButton key={r.value} value={r.value}>{r.label}</ToggleButton>)}
            </ToggleButtonGroup>
            <ToggleButtonGroup size="small" exclusive value={seriesBy} onChange={(_, v) => v && setSeriesBy(v)} aria-label="Split chart by">
              <ToggleButton value="feature">By feature</ToggleButton>
              <ToggleButton value="model">By model</ToggleButton>
              <ToggleButton value="provider">By provider</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup size="small" exclusive value={bucket} onChange={(_, v) => v && setBucket(v)} aria-label="Group by">
              <ToggleButton value="day">Daily</ToggleButton>
              <ToggleButton value="month">Monthly</ToggleButton>
            </ToggleButtonGroup>
            {loading && <CircularProgress size={20} />}
          </Box>

          <Paper sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Cost over time (USD)</Typography>
            <Box sx={{ height: 320 }}>
              {chart && chart.labels.length > 0 ? (
                <Bar
                  data={chart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { stacked: true, grid: { display: false } },
                      y: { stacked: true, ticks: { callback: (v) => usd(v) } },
                    },
                    plugins: {
                      legend: { position: 'bottom' },
                      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${usd(c.parsed.y)}` } },
                    },
                  }}
                />
              ) : (
                <Typography color="text.secondary">No calls recorded in this range yet.</Typography>
              )}
            </Box>
          </Paper>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <UsageTable
                title="By model"
                nameLabel="Model"
                rows={byModel}
                renderName={(r) => (<>{r.key} <Chip label={r.provider} size="small" variant="outlined" sx={{ ml: 0.5 }} /></>)}
              />
            </Grid>
            <Grid item xs={12} md={6}><UsageTable title="By feature" nameLabel="Feature" rows={byFeature} /></Grid>
          </Grid>

          <Paper sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
              <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>Users</Typography>
              <ToggleButtonGroup size="small" exclusive value={sort} onChange={(_, v) => v && setSort(v)} aria-label="Sort users by">
                <ToggleButton value="cost">Cost</ToggleButton>
                <ToggleButton value="calls">Calls</ToggleButton>
                <ToggleButton value="tokens">Tokens</ToggleButton>
              </ToggleButtonGroup>
              <TextField size="small" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell><TableCell>Tier</TableCell>
                    <TableCell align="right">Calls</TableCell><TableCell align="right">Tokens</TableCell>
                    <TableCell align="right">Cost</TableCell><TableCell>Last call</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.users.length === 0 && (
                    <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No users with AI calls in this range.</Typography></TableCell></TableRow>
                  )}
                  {users.users.map((u) => (
                    <TableRow key={u.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenUser(u.id)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{u.name || u.email}</Typography>
                        {u.name && <Typography variant="caption" color="text.secondary">{u.email}</Typography>}
                      </TableCell>
                      <TableCell><Chip label={u.tier} size="small" variant="outlined" /></TableCell>
                      <TableCell align="right">{u.calls.toLocaleString()}</TableCell>
                      <TableCell align="right">{tokens(u)}</TableCell>
                      <TableCell align="right"><strong>{usd(u.costUsd)}</strong></TableCell>
                      <TableCell>{u.lastCallAt ? new Date(u.lastCallAt).toLocaleDateString() : ''}</TableCell>
                    </TableRow>
                  ))}
                  {users.noUser && users.noUser.calls > 0 && (
                    <TableRow>
                      <TableCell><Typography variant="body2" fontStyle="italic">No signed-in user (guests, background jobs, embeddings)</Typography></TableCell>
                      <TableCell />
                      <TableCell align="right">{users.noUser.calls.toLocaleString()}</TableCell>
                      <TableCell align="right">{tokens(users.noUser)}</TableCell>
                      <TableCell align="right"><strong>{usd(users.noUser.costUsd)}</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </>
      )}

      <UserDialog userId={openUser} range={range} onClose={() => setOpenUser(null)} />
    </Container>
  );
}
