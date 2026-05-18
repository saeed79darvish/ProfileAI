import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Work as WorkIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { harvestAPI } from '../../services/api';
import GreenhouseIntegration from '../../components/GreenhouseIntegration';

export default function HarvestJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);
  const [connected, setConnected] = useState(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await harvestAPI.getJobs();
      setJobs(data.jobs || []);
      setConnected(true);
    } catch (err) {
      if (err.response?.status === 404) {
        setConnected(false);
      } else {
        setError(err.response?.data?.error || 'Failed to load jobs');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleViewDetail = async (jobId) => {
    setSelectedJob(jobId);
    setDetailLoading(true);
    try {
      const { data } = await harvestAPI.getJob(jobId);
      setJobDetail(data);
    } catch {
      setJobDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const q = search.toLowerCase();
    return (
      job.title?.toLowerCase().includes(q) ||
      job.location?.toLowerCase().includes(q) ||
      job.departments?.some((d) => d.toLowerCase().includes(q))
    );
  });

  const formatSalary = (min, max) => {
    if (!min && !max) return null;
    const fmt = (v) => `$${(v / 1000).toFixed(0)}k`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `${fmt(min)}+`;
    return `Up to ${fmt(max)}`;
  };

  // If not connected, show the integration form
  if (!loading && connected === false) {
    return (
      <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh', pt: 4 }}>
        <Container maxWidth="md">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/recruiter/dashboard')}
            sx={{ mb: 3, textTransform: 'none', color: '#6b7280' }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
            Greenhouse ATS Jobs
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Connect your Greenhouse Harvest API to import and view your ATS jobs here.
          </Typography>
          <GreenhouseIntegration onConnected={() => fetchJobs()} />
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh', pt: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/recruiter/dashboard')}
              sx={{ mb: 1, textTransform: 'none', color: '#6b7280' }}
            >
              Back to Dashboard
            </Button>
            <Typography variant="h4" fontWeight={700}>
              Greenhouse ATS Jobs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {jobs.length} jobs imported from your Greenhouse account
            </Typography>
          </Box>
          <Chip
            label={`${jobs.length} jobs`}
            icon={<WorkIcon />}
            sx={{ bgcolor: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search jobs by title, location, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 3, bgcolor: 'white', borderRadius: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#9ca3af' }} />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredJobs.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <WorkIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {search ? 'No jobs match your search' : 'No open jobs found'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {filteredJobs.map((job) => (
              <Grid item xs={12} sm={6} md={4} key={job.id}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 4 },
                  }}
                  onClick={() => handleViewDetail(job.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Chip
                        label={job.status}
                        size="small"
                        sx={{
                          bgcolor: job.status === 'open' ? '#d1fae5' : '#fee2e2',
                          color: job.status === 'open' ? '#065f46' : '#991b1b',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                      {job.confidential && (
                        <Chip label="Confidential" size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      )}
                    </Box>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, lineHeight: 1.3 }}>
                      {job.title}
                    </Typography>
                    {job.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <LocationIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                        <Typography variant="caption" color="text.secondary">
                          {job.location}
                        </Typography>
                      </Box>
                    )}
                    {job.departments?.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <BusinessIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                        <Typography variant="caption" color="text.secondary">
                          {job.departments.join(', ')}
                        </Typography>
                      </Box>
                    )}
                    {(job.salaryMin || job.salaryMax) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <MoneyIcon sx={{ fontSize: 14, color: '#10b981' }} />
                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                          {formatSalary(job.salaryMin, job.salaryMax)}
                        </Typography>
                      </Box>
                    )}
                    {job.openings > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PeopleIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                        <Typography variant="caption" color="text.secondary">
                          {job.openings} opening{job.openings > 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    )}
                    {/* Hiring Manager / Recruiter on card */}
                    {job.hiringTeam?.length > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        {job.hiringTeam.filter(m => m.role === 'Hiring Manager' || m.role === 'Lead Recruiter').slice(0, 2).map((m, i) => (
                          <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                            {m.role}: <strong>{m.name}</strong>
                          </Typography>
                        ))}
                      </Box>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      Updated {new Date(job.updatedAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Job Detail Dialog */}
      <Dialog
        open={!!selectedJob}
        onClose={() => { setSelectedJob(null); setJobDetail(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            Job Details
          </Typography>
          <IconButton onClick={() => { setSelectedJob(null); setJobDetail(null); }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : jobDetail ? (
            <Box>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                {jobDetail.job.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip label={jobDetail.job.status} size="small" color={jobDetail.job.status === 'open' ? 'success' : 'default'} />
                {jobDetail.job.location && (
                  <Chip icon={<LocationIcon />} label={jobDetail.job.location} size="small" variant="outlined" />
                )}
                {jobDetail.job.departments?.map((d, i) => (
                  <Chip key={i} label={d} size="small" variant="outlined" />
                ))}
              </Box>

              {(jobDetail.job.salaryMin || jobDetail.job.salaryMax) && (
                <Alert severity="info" icon={<MoneyIcon />} sx={{ mb: 2 }}>
                  Salary range: {formatSalary(jobDetail.job.salaryMin, jobDetail.job.salaryMax)}
                </Alert>
              )}

              {/* Hiring Team */}
              {jobDetail.hiringTeam?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Hiring Team
                  </Typography>
                  <List dense disablePadding>
                    {jobDetail.hiringTeam.map((member, i) => (
                      <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                        <ListItemAvatar>
                          <Avatar sx={{
                            width: 32, height: 32, fontSize: '0.8rem',
                            bgcolor: member.role === 'Hiring Manager' ? '#dbeafe' : '#ede9fe',
                            color: member.role === 'Hiring Manager' ? '#1d4ed8' : '#6d28d9',
                          }}>
                            {member.name?.charAt(0) || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.name}
                          secondary={member.role}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Openings */}
              {jobDetail.job.openings > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Openings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {jobDetail.job.openings} open position{jobDetail.job.openings > 1 ? 's' : ''}
                  </Typography>
                </Box>
              )}

              {/* Timestamps */}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Created</Typography>
                  <Typography variant="body2">{new Date(jobDetail.job.createdAt).toLocaleDateString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Updated</Typography>
                  <Typography variant="body2">{new Date(jobDetail.job.updatedAt).toLocaleDateString()}</Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Alert severity="error">Could not load job details.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSelectedJob(null); setJobDetail(null); }} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
