import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Grid, Paper,
  Chip, alpha, Divider, CircularProgress
} from '@mui/material';
import {
  People as PeopleIcon,
  Work as WorkIcon,
  Psychology as AIIcon,
  LocalOffer as PromoIcon,
  TrendingUp as TrendingUpIcon,
  AdminPanelSettings as AdminIcon,
  PersonAdd as NewUserIcon,
  Article as PostIcon
} from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../designTokens';
import {
  StatCardWrapper,
  StatCardContent,
  StatCardRow,
  StatIconBox,
  GrowthRow,
  GrowthIconBox,
} from './styled';
import {
  STAT_CARDS_CONFIG,
  TIER_COLORS,
  GROWTH_COLORS,
} from './constants';

const StatCard = ({ title, value, icon, color = COLORS.PRIMARY, subtitle, onClick }) => (
  <StatCardWrapper $clickable={!!onClick} onClick={onClick}>
    <StatCardContent>
      <StatCardRow>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={700}>
            {value?.toLocaleString() ?? '—'}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <StatIconBox $color={color}>
          {icon}
        </StatIconBox>
      </StatCardRow>
    </StatCardContent>
  </StatCardWrapper>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data } = await adminAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error">Failed to load admin dashboard.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <AdminIcon sx={{ color: COLORS.PRIMARY, fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            Admin Dashboard
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Welcome back, {user?.firstName}. Here's your platform overview.
        </Typography>
      </Box>

      {/* Top Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={STAT_CARDS_CONFIG.USERS.label}
            value={stats.users.total}
            icon={<PeopleIcon />}
            color={STAT_CARDS_CONFIG.USERS.color}
            subtitle={`+${stats.users.newThisWeek} this week`}
            onClick={() => navigate('/admin/users')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={STAT_CARDS_CONFIG.JOBS.label}
            value={stats.content.jobs}
            icon={<WorkIcon />}
            color={STAT_CARDS_CONFIG.JOBS.color}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={STAT_CARDS_CONFIG.AI.label}
            value={stats.ai.usageThisMonth}
            icon={<AIIcon />}
            color={STAT_CARDS_CONFIG.AI.color}
            subtitle={`${stats.ai.totalUsage} all-time`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={STAT_CARDS_CONFIG.PROMOS.label}
            value={stats.promos.activeCodes}
            icon={<PromoIcon />}
            color={STAT_CARDS_CONFIG.PROMOS.color}
            subtitle={`${stats.promos.totalRedemptions} redemptions`}
            onClick={() => navigate('/admin/promos')}
          />
        </Grid>
      </Grid>

      {/* Detail Cards */}
      <Grid container spacing={3}>
        {/* User Breakdown */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              User Breakdown
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Chip label="Candidates" size="small" color="primary" variant="outlined" />
                  <Typography fontWeight={600}>{stats.users.candidates}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Chip label="Recruiters" size="small" color="secondary" variant="outlined" />
                  <Typography fontWeight={600}>{stats.users.recruiters}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="Admins" size="small" color="error" variant="outlined" />
                  <Typography fontWeight={600}>{stats.users.admins}</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  By Subscription Tier
                </Typography>
                {Object.entries(stats.users.byTier || {}).map(([tier, count]) => (
                  <Box key={tier} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                      label={tier}
                      size="small"
                      sx={{
                        bgcolor: alpha(TIER_COLORS[tier] || COLORS.TEXT_SECONDARY, 0.1),
                        color: TIER_COLORS[tier] || COLORS.TEXT_SECONDARY,
                      }}
                    />
                    <Typography fontWeight={600}>{count}</Typography>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Growth */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Growth
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <GrowthRow>
              <GrowthIconBox $color={GROWTH_COLORS.NEW_MONTH}>
                <NewUserIcon sx={{ color: GROWTH_COLORS.NEW_MONTH }} />
              </GrowthIconBox>
              <Box>
                <Typography variant="h5" fontWeight={700}>{stats.users.newThisMonth}</Typography>
                <Typography variant="body2" color="text.secondary">New users (30 days)</Typography>
              </Box>
            </GrowthRow>
            <GrowthRow>
              <GrowthIconBox $color={GROWTH_COLORS.NEW_WEEK}>
                <TrendingUpIcon sx={{ color: GROWTH_COLORS.NEW_WEEK }} />
              </GrowthIconBox>
              <Box>
                <Typography variant="h5" fontWeight={700}>{stats.users.newThisWeek}</Typography>
                <Typography variant="body2" color="text.secondary">New users (7 days)</Typography>
              </Box>
            </GrowthRow>
            <GrowthRow>
              <GrowthIconBox $color={GROWTH_COLORS.POSTS}>
                <PostIcon sx={{ color: GROWTH_COLORS.POSTS }} />
              </GrowthIconBox>
              <Box>
                <Typography variant="h5" fontWeight={700}>{stats.content.posts}</Typography>
                <Typography variant="body2" color="text.secondary">Total posts</Typography>
              </Box>
            </GrowthRow>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Quick Actions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={<PeopleIcon />} label="Manage Users" clickable
                onClick={() => navigate('/admin/users')}
                sx={{ px: 1, py: 2.5, fontSize: '0.875rem' }}
              />
              <Chip
                icon={<PromoIcon />} label="Manage Promos" clickable
                onClick={() => navigate('/admin/promos')}
                sx={{ px: 1, py: 2.5, fontSize: '0.875rem' }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
