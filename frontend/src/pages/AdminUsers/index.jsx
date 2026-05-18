import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Select, MenuItem, FormControl,
  InputLabel, Chip, IconButton, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, InputAdornment, Alert, Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { adminAPI } from '../../services/api';
import { ROLE_COLORS, TIER_STYLES, DEFAULT_ROWS_PER_PAGE, ROWS_PER_PAGE_OPTIONS, SEARCH_DEBOUNCE_MS } from './constants';
import { buildUserParams } from './utils';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Role edit dialog
  const [roleDialog, setRoleDialog] = useState({ open: false, user: null, newRole: '' });
  // Tier edit dialog
  const [tierDialog, setTierDialog] = useState({ open: false, user: null, newTier: '' });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildUserParams(page, rowsPerPage, search, roleFilter, tierFilter);
      const response = await adminAPI.getUsers(params);
      const { data } = response;
      if (data && data.users) {
        setUsers(data.users);
        setTotal(data.pagination?.total || 0);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, roleFilter, tierFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Debounced search
  const [searchTimer, setSearchTimer] = useState(null);
  const handleSearchChange = (val) => {
    setSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(setTimeout(() => { setPage(0); }, SEARCH_DEBOUNCE_MS));
  };

  const handleChangeRole = async () => {
    try {
      const { data } = await adminAPI.changeRole(roleDialog.user.id, roleDialog.newRole);
      setSnack({ open: true, message: data.message, severity: 'success' });
      setRoleDialog({ open: false, user: null, newRole: '' });
      loadUsers();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'Failed', severity: 'error' });
    }
  };

  const handleChangeTier = async () => {
    try {
      const { data } = await adminAPI.changeTier(tierDialog.user.id, tierDialog.newTier);
      setSnack({ open: true, message: data.message, severity: 'success' });
      setTierDialog({ open: false, user: null, newTier: '' });
      loadUsers();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'Failed', severity: 'error' });
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const { data } = await adminAPI.toggleActive(user.id);
      setSnack({ open: true, message: data.message, severity: 'success' });
      loadUsers();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'Failed', severity: 'error' });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/admin')}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>User Management</Typography>
          <Typography variant="body2" color="text.secondary">{total} total users</Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Role</InputLabel>
          <Select value={roleFilter} label="Role" onChange={e => { setRoleFilter(e.target.value); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="candidate">Candidate</MenuItem>
            <MenuItem value="recruiter">Recruiter</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Tier</InputLabel>
          <Select value={tierFilter} label="Tier" onChange={e => { setTierFilter(e.target.value); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="free">Free</MenuItem>
            <MenuItem value="pro">Pro</MenuItem>
            <MenuItem value="enterprise">Enterprise</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Tier</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Joined</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{u.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={u.role} 
                        size="small" 
                        color={ROLE_COLORS[u.role] || 'default'}
                        variant="outlined"
                        icon={u.role === 'admin' ? <ShieldIcon /> : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={u.subscriptionTier || 'free'} 
                        size="small" 
                        sx={TIER_STYLES[u.subscriptionTier || 'free']}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={u.isActive !== false ? 'Active' : 'Inactive'} 
                        size="small" 
                        color={u.isActive !== false ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        size="small" title="Change role"
                        onClick={() => setRoleDialog({ open: true, user: u, newRole: u.role })}
                      >
                        <AdminPanelSettingsIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" title="Change tier"
                        onClick={() => setTierDialog({ open: true, user: u, newTier: u.subscriptionTier || 'free' })}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" title={u.isActive !== false ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(u)}
                        color={u.isActive !== false ? 'default' : 'success'}
                      >
                        {u.isActive !== false ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No users found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            />
          </>
        )}
      </TableContainer>

      {/* Role Change Dialog */}
      <Dialog open={roleDialog.open} onClose={() => setRoleDialog({ open: false, user: null, newRole: '' })}>
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          {roleDialog.user && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {roleDialog.user.firstName} {roleDialog.user.lastName} ({roleDialog.user.email})
              </Typography>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Role</InputLabel>
                <Select value={roleDialog.newRole} label="Role" onChange={e => setRoleDialog(d => ({ ...d, newRole: e.target.value }))}>
                  <MenuItem value="candidate">Candidate</MenuItem>
                  <MenuItem value="recruiter">Recruiter</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              {roleDialog.newRole === 'admin' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Admin users have full access to all platform management features.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialog({ open: false, user: null, newRole: '' })}>Cancel</Button>
          <Button onClick={handleChangeRole} variant="contained" disabled={roleDialog.newRole === roleDialog.user?.role}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tier Change Dialog */}
      <Dialog open={tierDialog.open} onClose={() => setTierDialog({ open: false, user: null, newTier: '' })}>
        <DialogTitle>Change Subscription Tier</DialogTitle>
        <DialogContent>
          {tierDialog.user && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {tierDialog.user.firstName} {tierDialog.user.lastName} ({tierDialog.user.email})
              </Typography>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Tier</InputLabel>
                <Select value={tierDialog.newTier} label="Tier" onChange={e => setTierDialog(d => ({ ...d, newTier: e.target.value }))}>
                  <MenuItem value="free">Free</MenuItem>
                  <MenuItem value="pro">Pro</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTierDialog({ open: false, user: null, newTier: '' })}>Cancel</Button>
          <Button onClick={handleChangeTier} variant="contained" disabled={tierDialog.newTier === (tierDialog.user?.subscriptionTier || 'free')}>
            Save
          </Button>
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
