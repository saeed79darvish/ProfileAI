import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, IconButton, CircularProgress, LinearProgress } from '@mui/material';
import { CheckCircle as DoneIcon, ErrorOutline as ErrorIcon, Close as CloseIcon } from '@mui/icons-material';
import { useBackgroundTasks } from '@/contexts/BackgroundTasksContext';

/**
 * What is running, and what has finished, wherever the user is.
 *
 * Hiding a progress modal used to leave no trace: the work carried on with no
 * sign of it anywhere, and a result that finished while the user was on
 * another page was never shown at all. This sits under the navbar on every
 * route, job pages included, and lists each task with how long it has been
 * running, then offers to take the user to the result when it is ready.
 */

const elapsed = (since) => {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export default function BackgroundTasksIndicator() {
  const { tasks, dismissTask } = useBackgroundTasks();
  const navigate = useNavigate();
  const [, tick] = useState(0);

  const list = Object.values(tasks).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  const running = list.filter((t) => t.status === 'running');

  // Re-render once a second while anything is running, for the elapsed time.
  useEffect(() => {
    if (!running.length) return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [running.length]);

  if (!list.length) return null;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        top: { xs: 'auto', sm: 76 },
        bottom: { xs: 16, sm: 'auto' },
        right: 16,
        left: { xs: 16, sm: 'auto' },
        zIndex: 1250, // above page content and the navbar, below dialogs (1300)
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        width: { sm: 340 },
      }}
    >
      {list.map((task) => (
        <Paper
          key={task.id}
          elevation={6}
          sx={{
            borderRadius: 2.5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor:
              task.status === 'error' ? '#fecaca' : task.status === 'done' ? '#bbf7d0' : '#e0e7ff',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25 }}>
            {task.status === 'running' && <CircularProgress size={18} thickness={5} sx={{ color: '#4f46e5' }} />}
            {task.status === 'done' && <DoneIcon sx={{ color: '#16a34a', fontSize: 20 }} />}
            {task.status === 'error' && <ErrorIcon sx={{ color: '#dc2626', fontSize: 20 }} />}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }} noWrap>
                {task.status === 'done' ? task.doneLabel || `${task.label} is ready` : task.label}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }} noWrap component="div">
                {task.status === 'running' && `Working in the background for ${elapsed(task.startedAt)}. You can keep browsing.`}
                {task.status === 'done' && (task.needsAttention ? 'Finished while you were away.' : 'Done.')}
                {task.status === 'error' && task.error}
              </Typography>
            </Box>

            {task.status === 'done' && task.needsAttention && task.openPath && (
              <Button
                size="small"
                variant="contained"
                onClick={() => navigate(task.openPath, { state: { reviewTask: task.id } })}
                sx={{ textTransform: 'none', borderRadius: 2, background: '#4f46e5', boxShadow: 'none' }}
              >
                Review
              </Button>
            )}
            {task.status !== 'running' && (
              <IconButton size="small" aria-label="Dismiss" onClick={() => dismissTask(task.id)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          {task.status === 'running' && <LinearProgress sx={{ height: 2 }} />}
        </Paper>
      ))}
    </Box>
  );
}
