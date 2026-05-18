import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Collapse,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  School as SchoolIcon,
  CheckCircle as CheckIcon,
  PlayCircle as InProgressIcon,
  RadioButtonUnchecked as PendingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lightbulb as TipIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import { tailoredProfileAPI } from '../services/api';

const severityColors = {
  critical: { color: '#ef4444', bg: '#fef2f2', label: '🔴 Critical' },
  important: { color: '#f59e0b', bg: '#fffbeb', label: '🟡 Important' },
  nice_to_have: { color: '#3b82f6', bg: '#eff6ff', label: '🔵 Nice to Have' }
};

const statusConfig = {
  pending: { icon: <PendingIcon fontSize="small" />, label: 'Not Started', color: 'default', next: 'in_progress' },
  in_progress: { icon: <InProgressIcon fontSize="small" color="warning" />, label: 'In Progress', color: 'warning', next: 'learned' },
  learned: { icon: <CheckIcon fontSize="small" color="success" />, label: 'Learned', color: 'success', next: 'pending' }
};

export default function LearningPlanWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    fetchLearningPlan();
  }, []);

  const fetchLearningPlan = async () => {
    try {
      const response = await tailoredProfileAPI.getLearningPlan();
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch learning plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (tailoredProfileId, gapIndex, currentStatus) => {
    const nextStatus = statusConfig[currentStatus]?.next || 'pending';
    const key = `${tailoredProfileId}-${gapIndex}`;
    
    setUpdating(prev => ({ ...prev, [key]: true }));
    try {
      await tailoredProfileAPI.updateGapStatus(tailoredProfileId, gapIndex, nextStatus);
      await fetchLearningPlan();
    } catch (err) {
      console.error('Failed to update gap status:', err);
    } finally {
      setUpdating(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (!data || data.gaps?.length === 0) {
    return null; // Don't show if no gaps exist
  }

  const { gaps, stats } = data;
  const progressPercent = stats.total > 0 ? ((stats.learned / stats.total) * 100) : 0;

  // Group gaps by job (tailoredProfileId)
  const jobGroups = {};
  gaps.forEach((gap, globalIndex) => {
    const jobKey = gap.tailoredProfileId;
    if (!jobGroups[jobKey]) {
      jobGroups[jobKey] = {
        jobTitle: gap.fromJob || 'Unknown Job',
        company: gap.fromCompany || '',
        tailoredProfileId: gap.tailoredProfileId,
        gaps: []
      };
    }
    jobGroups[jobKey].gaps.push({ ...gap, globalIndex });
  });

  const jobList = Object.values(jobGroups);

  return (
    <Paper sx={{ overflow: 'hidden', mb: 3 }}>
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #f59e0b15 0%, #ef444415 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <SchoolIcon sx={{ color: '#f59e0b' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            📚 Skills Learning Plan
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stats.learned} of {stats.total} skills learned • {stats.inProgress} in progress
          </Typography>
        </Box>
        <Chip 
          label={`${Math.round(progressPercent)}%`}
          size="small"
          color={progressPercent >= 75 ? 'success' : progressPercent >= 40 ? 'warning' : 'error'}
        />
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      <Collapse in={expanded}>
        {/* Progress Bar */}
        <Box sx={{ px: 2, pt: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={progressPercent}
            sx={{ 
              height: 8, 
              borderRadius: 4,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #f59e0b, #34d399)',
                borderRadius: 4
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {stats.pending} pending
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.inProgress} in progress
            </Typography>
            <Typography variant="caption" color="success.main" fontWeight="bold">
              {stats.learned} learned ✓
            </Typography>
          </Box>
        </Box>

        {/* Gap List - Grouped by Job */}
        <Box sx={{ p: 2 }}>
          {jobList.map((job, jobIndex) => {
            const jobLearned = job.gaps.filter(g => g.status === 'learned').length;
            const jobTotal = job.gaps.length;
            const jobProgress = jobTotal > 0 ? Math.round((jobLearned / jobTotal) * 100) : 0;

            return (
              <Box key={job.tailoredProfileId} sx={{ mb: jobIndex < jobList.length - 1 ? 2 : 0 }}>
                {/* Job Header */}
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    py: 1,
                    px: 1,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <WorkIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="bold" noWrap>
                      {job.jobTitle}
                    </Typography>
                    {job.company && (
                      <Typography variant="caption" color="text.secondary">
                        at {job.company}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={`${jobLearned}/${jobTotal}`}
                    size="small"
                    color={jobProgress >= 75 ? 'success' : jobProgress >= 40 ? 'warning' : 'default'}
                    variant="outlined"
                    sx={{ fontSize: '10px', height: 22 }}
                  />
                </Box>

                {/* Gaps for this job */}
                {job.gaps.map((gap, i) => {
                  const severity = severityColors[gap.severity] || severityColors.nice_to_have;
                  const status = statusConfig[gap.status] || statusConfig.pending;
                  const key = `${gap.tailoredProfileId}-${i}`;
                  const isUpdating = updating[key];

                  const gapOriginalIndex = gaps
                    .filter(g => g.tailoredProfileId === gap.tailoredProfileId)
                    .findIndex(g => g.skill === gap.skill);

                  return (
                    <Box 
                      key={i}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        py: 1.5,
                        px: 1,
                        ml: 2,
                        borderBottom: i < job.gaps.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        opacity: gap.status === 'learned' ? 0.6 : 1,
                        '&:hover': { bgcolor: 'grey.50' },
                        borderRadius: 1
                      }}
                    >
                      <Tooltip title={`Click to mark as ${statusConfig[status.next]?.label || 'pending'}`}>
                        <IconButton 
                          size="small"
                          onClick={() => handleStatusChange(gap.tailoredProfileId, gapOriginalIndex, gap.status)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? <CircularProgress size={18} /> : status.icon}
                        </IconButton>
                      </Tooltip>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography 
                            variant="body2" 
                            fontWeight="bold"
                            sx={{ textDecoration: gap.status === 'learned' ? 'line-through' : 'none' }}
                          >
                            {gap.skill}
                          </Typography>
                          <Chip 
                            label={severity.label}
                            size="small"
                            sx={{ fontSize: '10px', height: 20, bgcolor: severity.bg, color: severity.color }}
                          />
                        </Box>
                        {gap.learningResource && gap.status !== 'learned' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <TipIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                            <Typography variant="caption" color="primary.main">
                              {gap.learningResource}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Chip
                        label={status.label}
                        size="small"
                        color={status.color}
                        variant="outlined"
                        sx={{ fontSize: '10px' }}
                      />
                    </Box>
                  );
                })}

                {jobIndex < jobList.length - 1 && <Divider sx={{ mt: 1 }} />}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}
