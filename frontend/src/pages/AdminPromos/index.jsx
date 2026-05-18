import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid,
  Snackbar, Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { adminAPI } from '../../services/api';
import { TYPE_LABELS, INITIAL_FORM_STATE } from './constants';
import { getBenefitText } from './utils';

export default function AdminPromos() {
  const navigate = useNavigate();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  
  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_FORM_STATE });

  // Redemptions dialog
  const [redemptionsDialog, setRedemptionsDialog] = useState({ open: false, promoId: null, redemptions: [], loading: false });

  useEffect(() => {
    loadPromos();
  }, []);

  const loadPromos = async () => {
    try {
      const { data } = await adminAPI.getPromos();
      setPromos(data.promos);
    } catch (err) {
      console.error('Failed to load promos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const payload = {
        code: form.code,
        description: form.description,
        type: form.type,
        durationDays: parseInt(form.durationDays) || 30,
        maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,
        validUntil: form.validUntil || null,
      };
      if (form.type === 'ai_bonus') {
        payload.dailyMultiplier = parseFloat(form.dailyMultiplier) || 1;
        payload.dailyBonusFlat = parseInt(form.dailyBonusFlat) || 0;
      }
      if (form.type === 'subscription_upgrade') {
        payload.grantTier = form.grantTier;
      }
      
      await adminAPI.createPromo(payload);
      setSnack({ open: true, message: `Promo "${form.code}" created!`, severity: 'success' });
      setCreateOpen(false);
      setForm({ ...INITIAL_FORM_STATE });
      loadPromos();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'Failed to create', severity: 'error' });
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      if (promo.isActive) {
        await adminAPI.deletePromo(promo.id);
      } else {
        await adminAPI.updatePromo(promo.id, { isActive: true });
      }
      setSnack({ open: true, message: `Promo "${promo.code}" ${promo.isActive ? 'deactivated' : 'activated'}`, severity: 'success' });
      loadPromos();
    } catch (err) {
      setSnack({ open: true, message: 'Failed to update', severity: 'error' });
    }
  };

  const showRedemptions = async (promoId) => {
    setRedemptionsDialog({ open: true, promoId, redemptions: [], loading: true });
    try {
      const { data } = await adminAPI.getRedemptions(promoId);
      setRedemptionsDialog(d => ({ ...d, redemptions: data.redemptions, loading: false }));
    } catch {
      setRedemptionsDialog(d => ({ ...d, loading: false }));
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setSnack({ open: true, message: `"${code}" copied!`, severity: 'info' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/admin')}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>Promo Codes</Typography>
            <Typography variant="body2" color="text.secondary">{promos.length} promo codes</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Promo Code
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Benefit</strong></TableCell>
              <TableCell><strong>Duration</strong></TableCell>
              <TableCell><strong>Redemptions</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Created By</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {promos.map(p => {
              const typeInfo = TYPE_LABELS[p.type] || TYPE_LABELS.ai_bonus;
              const benefit = getBenefitText(p);

              return (
                <TableRow key={p.id} hover sx={{ opacity: p.isActive ? 1 : 0.5 }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography fontWeight={700} fontFamily="monospace" fontSize="0.9rem">
                        {p.code}
                      </Typography>
                      <IconButton size="small" onClick={() => copyCode(p.code)}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                    {p.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {p.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={typeInfo.label} size="small" sx={{ bgcolor: alpha(typeInfo.color, 0.1), color: typeInfo.color }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{benefit}</Typography>
                  </TableCell>
                  <TableCell>{p.durationDays}d</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {p.currentRedemptions}{p.maxRedemptions ? `/${p.maxRedemptions}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={p.isActive ? 'Active' : 'Inactive'} 
                      size="small" 
                      color={p.isActive ? 'success' : 'default'} 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    {p.creator ? `${p.creator.firstName} ${p.creator.lastName}` : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View redemptions">
                      <IconButton size="small" onClick={() => showRedemptions(p.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={p.isActive ? 'Deactivate' : 'Activate'}>
                      <IconButton size="small" onClick={() => handleToggleActive(p)} color={p.isActive ? 'default' : 'success'}>
                        {p.isActive ? <DeleteIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {promos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No promo codes yet. Create one!</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Promo Code</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Code"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. LAUNCH2X"
              inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 1 } }}
              fullWidth
            />
            <TextField
              label="Description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <MenuItem value="ai_bonus">AI Bonus (extra daily credits)</MenuItem>
                <MenuItem value="subscription_upgrade">Subscription Upgrade</MenuItem>
                <MenuItem value="trial_extension">Trial Extension</MenuItem>
              </Select>
            </FormControl>

            {form.type === 'ai_bonus' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Daily Multiplier"
                    type="number"
                    value={form.dailyMultiplier}
                    onChange={e => setForm(f => ({ ...f, dailyMultiplier: e.target.value }))}
                    helperText="e.g. 2 = double credits"
                    inputProps={{ min: 1, step: 0.5 }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Flat Bonus Per Feature"
                    type="number"
                    value={form.dailyBonusFlat}
                    onChange={e => setForm(f => ({ ...f, dailyBonusFlat: e.target.value }))}
                    helperText="Extra credits added"
                    inputProps={{ min: 0 }}
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}

            {form.type === 'subscription_upgrade' && (
              <FormControl fullWidth>
                <InputLabel>Grant Tier</InputLabel>
                <Select value={form.grantTier} label="Grant Tier" onChange={e => setForm(f => ({ ...f, grantTier: e.target.value }))}>
                  <MenuItem value="pro">Pro</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                </Select>
              </FormControl>
            )}

            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  label="Duration (days)"
                  type="number"
                  value={form.durationDays}
                  onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))}
                  inputProps={{ min: 1 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Max Redemptions"
                  type="number"
                  value={form.maxRedemptions}
                  onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                  placeholder="Unlimited"
                  inputProps={{ min: 1 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Expires On"
                  type="date"
                  value={form.validUntil}
                  onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={!form.code.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Redemptions Dialog */}
      <Dialog 
        open={redemptionsDialog.open} 
        onClose={() => setRedemptionsDialog(d => ({ ...d, open: false }))}
        maxWidth="sm" fullWidth
      >
        <DialogTitle>Redemptions</DialogTitle>
        <DialogContent>
          {redemptionsDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
          ) : redemptionsDialog.redemptions.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No redemptions yet.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>User</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Redeemed</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {redemptionsDialog.redemptions.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.user?.firstName} {r.user?.lastName}</TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{r.user?.email}</TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip 
                        label={r.isActive && new Date(r.expiresAt) > new Date() ? 'Active' : 'Expired'} 
                        size="small" 
                        color={r.isActive && new Date(r.expiresAt) > new Date() ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRedemptionsDialog(d => ({ ...d, open: false }))}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
