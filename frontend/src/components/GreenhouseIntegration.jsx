import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Sync as SyncIcon,
  Work as WorkIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { harvestAPI } from '../services/api';

export default function GreenhouseIntegration({ onConnected }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await harvestAPI.getStatus();
      setStatus(data);
      if (data.connected && onConnected) onConnected(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [onConnected]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    setConnecting(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await harvestAPI.connect(apiKey.trim(), label.trim() || undefined);
      setSuccess(`Connected! Found ${data.integration.jobCount} jobs.`);
      setApiKey('');
      setLabel('');
      setExpanded(false);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect. Check your API key.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError('');
    setSuccess('');
    try {
      await harvestAPI.disconnect();
      setStatus({ connected: false });
      setSuccess('Disconnected from Greenhouse.');
      if (onConnected) onConnected(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect.');
    }
  };

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 3, border: status?.connected ? '1px solid #10b981' : '1px solid #e5e7eb' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="https://logo.clearbit.com/greenhouse.io"
              alt="Greenhouse"
              sx={{ width: 24, height: 24, borderRadius: 0.5 }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <Typography variant="subtitle1" fontWeight={600}>
              Greenhouse ATS
            </Typography>
          </Box>
          <Chip
            icon={status?.connected ? <CheckCircleIcon /> : undefined}
            label={status?.connected ? 'Connected' : 'Not Connected'}
            size="small"
            sx={{
              bgcolor: status?.connected ? '#d1fae5' : '#f3f4f6',
              color: status?.connected ? '#065f46' : '#6b7280',
              fontWeight: 600,
              '& .MuiChip-icon': { color: '#10b981' },
            }}
          />
        </Box>

        {status?.connected ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WorkIcon sx={{ fontSize: 16, color: '#6d28d9' }} />
                <Typography variant="body2" fontWeight={500}>
                  {status.integration.jobCount} jobs
                </Typography>
              </Box>
              {status.integration.label && (
                <Typography variant="caption" color="text.secondary">
                  {status.integration.label}
                </Typography>
              )}
            </Box>
            {status.integration.lastSyncAt && (
              <Typography variant="caption" color="text.secondary">
                Last synced: {new Date(status.integration.lastSyncAt).toLocaleString()}
              </Typography>
            )}
            {status.integration.syncError && (
              <Alert severity="warning" sx={{ mt: 1 }} icon={<ErrorIcon fontSize="small" />}>
                {status.integration.syncError}
              </Alert>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/recruiter/greenhouse')}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
              >
                View Jobs
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={fetchStatus}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
              >
                Refresh
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={<LinkOffIcon />}
                onClick={handleDisconnect}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
              >
                Disconnect
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Connect your Greenhouse Harvest API to import jobs, hiring teams, and more.
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={expanded ? <ExpandLessIcon /> : <LinkIcon />}
              onClick={() => setExpanded(!expanded)}
              sx={{
                textTransform: 'none',
                bgcolor: '#7c3aed',
                fontWeight: 600,
                '&:hover': { bgcolor: '#6d28d9' },
              }}
            >
              {expanded ? 'Cancel' : 'Connect Greenhouse'}
            </Button>
            <Collapse in={expanded}>
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Harvest API Key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Greenhouse Harvest API key"
                  sx={{ mb: 1.5 }}
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                        {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Label (optional)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. My Company ATS"
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleConnect}
                  disabled={connecting || !apiKey.trim()}
                  startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
                  sx={{
                    textTransform: 'none',
                    bgcolor: '#10b981',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  {connecting ? 'Connecting...' : 'Connect & Sync'}
                </Button>
              </Box>
            </Collapse>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 1.5 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
