import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, TextField, IconButton, Alert,
  CircularProgress, Divider, Link, Tooltip,
} from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';

import { careerContextAPI } from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal';
import { trackEvent } from '@/utils/analytics';
import { TEXT, FIELDS, CONSTRAINT_FIELDS } from './constants';

/**
 * What ProfilleAI knows about you.
 *
 * Everything the coach has kept beyond the resume: the role you are aiming
 * for, why, what is in the way, practical constraints, its assessment, and
 * a short summary of each voice call. Keeping someone's goals is only fair
 * if they can see all of it and remove any of it, so every item here can be
 * edited or deleted, and so can the whole record.
 */

const EditableRow = ({ label, value, multiline, onSave, onDelete, busy }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);

  return (
    <Box sx={{ py: 1.75, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Typography
        variant="caption"
        sx={{ flex: '0 0 150px', pt: 0.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#8a8aa3' }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(draft.trim());
              setEditing(false);
            }}
            sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}
          >
            <TextField
              size="small"
              fullWidth
              multiline={multiline}
              minRows={multiline ? 2 : undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              inputProps={{ 'aria-label': label }}
              sx={{ flex: 1, minWidth: 220 }}
            />
            <Button type="submit" variant="contained" size="small" disabled={busy}>{TEXT.SAVE}</Button>
            <Button size="small" onClick={() => setEditing(false)}>{TEXT.CANCEL}</Button>
          </Box>
        ) : (
          <Typography sx={{ color: value ? '#1a1a2e' : '#a0a0b8', fontStyle: value ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
            {value || TEXT.EMPTY}
          </Typography>
        )}
      </Box>
      {!editing && (
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <Tooltip title={TEXT.EDIT}>
            <IconButton size="small" onClick={() => setEditing(true)} aria-label={`${TEXT.EDIT} ${label}`} disabled={busy}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {value && (
            <Tooltip title={TEXT.DELETE}>
              <IconButton size="small" onClick={onDelete} aria-label={`${TEXT.DELETE} ${label}`} disabled={busy}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

const AboutYou = () => {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    careerContextAPI.get()
      .then(({ data }) => { if (!cancelled) setContext(data?.context || null); })
      .catch(() => { if (!cancelled) setError(TEXT.LOAD_FAILED); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const run = useCallback(async (fn, event) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setContext(data?.context || null);
      if (event) trackEvent('about_you_changed', { action: event });
    } catch {
      setError(TEXT.SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }, []);

  const editConstraint = (key, value) => {
    const constraints = { ...(context?.constraints || {}) };
    if (key === 'roleTypes') constraints.roleTypes = value.split(',').map((v) => v.trim()).filter(Boolean);
    else constraints[key] = value;
    return run(() => careerContextAPI.edit({ constraints }), 'edit');
  };

  const constraintValue = (key) => {
    const value = context?.constraints?.[key];
    return Array.isArray(value) ? value.join(', ') : (value || '');
  };

  const hasAnything = !!context && (
    FIELDS.some((f) => context[f.key])
    || Object.keys(context.constraints || {}).length
    || context.assessment
    || (context.summaries || []).length
  );

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Link component={RouterLink} to="/profile" underline="hover" sx={{ fontSize: 14 }}>{TEXT.BACK}</Link>
      <Typography variant="h4" component="h1" sx={{ mt: 1.5, fontWeight: 700, color: '#1a1a2e' }}>{TEXT.TITLE}</Typography>
      <Typography sx={{ mt: 1, mb: 3, color: '#6c6c86', maxWidth: 640 }}>{TEXT.INTRO}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{TEXT.GOALS}</Typography>
            {FIELDS.map((f, i) => (
              <Box key={f.key}>
                {i > 0 && <Divider />}
                <EditableRow
                  label={f.label}
                  value={context?.[f.key] || ''}
                  multiline={f.multiline}
                  busy={busy}
                  onSave={(value) => run(() => careerContextAPI.edit({ [f.key]: value }), 'edit')}
                  onDelete={() => run(() => careerContextAPI.forget({ field: f.key }), 'forget')}
                />
              </Box>
            ))}
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{TEXT.CONSTRAINTS}</Typography>
            {CONSTRAINT_FIELDS.map((f, i) => (
              <Box key={f.key}>
                {i > 0 && <Divider />}
                <EditableRow
                  label={f.label}
                  value={constraintValue(f.key)}
                  busy={busy}
                  onSave={(value) => editConstraint(f.key, value)}
                  onDelete={() => run(() => careerContextAPI.forget({ field: f.key }), 'forget')}
                />
              </Box>
            ))}
          </Paper>

          {context?.assessment && (
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{TEXT.ASSESSMENT}</Typography>
                <Tooltip title={TEXT.DELETE}>
                  <IconButton size="small" aria-label={`${TEXT.DELETE} ${TEXT.ASSESSMENT}`} disabled={busy}
                    onClick={() => run(() => careerContextAPI.forget({ field: 'assessment' }), 'forget')}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {context.assessment.verdict && (
                <Typography sx={{ mt: 1, fontWeight: 600, textTransform: 'capitalize' }}>{context.assessment.verdict}</Typography>
              )}
              {context.assessment.headline && <Typography sx={{ mt: 0.5, color: '#4a4a63' }}>{context.assessment.headline}</Typography>}
              {!!context.assessment.closes?.length && (
                <Box component="ul" sx={{ mt: 1.5, mb: 0, pl: 2.5, color: '#4a4a63' }}>
                  {context.assessment.closes.map((c, i) => <li key={i}>{c.what}</li>)}
                </Box>
              )}
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{TEXT.CALLS}</Typography>
            <Typography variant="body2" sx={{ color: '#6c6c86', mt: 0.5, mb: 1 }}>{TEXT.CALLS_NOTE}</Typography>
            {(context?.summaries || []).length ? (
              [...context.summaries].map((s, i) => ({ ...s, i })).reverse().map((s) => (
                <Box key={`${s.at}${s.i}`} sx={{ py: 1.5, display: 'flex', gap: 2, borderTop: '1px solid #f0f0f6' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#8a8aa3' }}>
                      {new Date(s.at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Typography>
                    <Typography sx={{ color: '#1a1a2e' }}>{s.text}</Typography>
                  </Box>
                  <Tooltip title={TEXT.DELETE}>
                    <IconButton size="small" aria-label={TEXT.DELETE_CALL} disabled={busy}
                      onClick={() => run(() => careerContextAPI.forget({ summaryIndex: s.i }), 'forget_call')}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))
            ) : (
              <Typography sx={{ color: '#a0a0b8', fontStyle: 'italic' }}>{TEXT.NO_CALLS}</Typography>
            )}
          </Paper>

          {hasAnything && (
            <Button color="error" variant="outlined" onClick={() => setConfirmClear(true)} disabled={busy}>
              {TEXT.CLEAR}
            </Button>
          )}
        </>
      )}

      <ConfirmModal
        show={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          run(() => careerContextAPI.clear(), 'clear');
        }}
        variant="danger"
        title={TEXT.CLEAR_TITLE}
        message={TEXT.CLEAR_BODY}
        confirmText={TEXT.CLEAR_CONFIRM}
        cancelText={TEXT.CANCEL}
      />
    </Container>
  );
};

export default AboutYou;
