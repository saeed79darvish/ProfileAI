import { useCallback, useEffect, useState } from 'react';
import {
  Paper, Typography, Box, Button, TextField, IconButton, Chip, Divider, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import { EditOutlined as EditIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';

import { careerContextAPI } from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal';

const T = {
  TITLE: 'Answers I remembered from your applications',
  PRIVACY: 'This stays private. We never share it, and we only use it to answer the custom questions on your applications.',
  DEMOGRAPHIC: 'Demographic questions (gender, race, veteran status, disability) are never remembered.',
  EMPTY: 'When you answer a question on an application, we remember it here so you are not asked again.',
  LOADING: 'Loading your remembered answers',
  LOAD_ERROR: 'We could not load your remembered answers.',
  RETRY: 'Try again',
  ACTION_ERROR: 'That did not work. Please try again.',
  EDIT: 'Edit',
  DELETE: 'Delete',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DELETE_ALL: 'Delete all of them',
  DELETE_ALL_TITLE: 'Delete all remembered answers?',
  DELETE_ALL_BODY: 'You will be asked these questions again the next time they come up on an application.',
  DELETE_ALL_CONFIRM: 'Delete all',
};

const dateOf = (v) => {
  const d = v ? new Date(v) : null;
  return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
};

const usageLine = (it) => {
  const n = Number(it.uses) || 0;
  const when = dateOf(it.lastUsedAt);
  const base = when ? `Used ${n} ${n === 1 ? 'time' : 'times'}, last on ${when}` : `Used ${n} ${n === 1 ? 'time' : 'times'}`;
  return it.company ? `${base}. ${it.company}` : base;
};

const Row = ({ item, busy, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.answer || '');
  const options = Array.isArray(item.options) ? item.options.filter(Boolean) : [];
  const close = () => { setEditing(false); setText(item.answer || ''); };
  const label = item.question;

  return (
    <Box sx={{ py: 1.75, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ color: '#6c6c86', overflowWrap: 'anywhere' }}>{item.question}</Typography>
        {editing && options.length ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1 }}>
            {options.map((o) => (
              <Chip
                key={o}
                label={o}
                clickable
                disabled={busy}
                color={o === item.answer ? 'primary' : 'default'}
                onClick={async () => { if (await onSave(item, o)) setEditing(false); }}
              />
            ))}
            <Button size="small" onClick={close}>{T.CANCEL}</Button>
          </Box>
        ) : editing ? (
          <Box
            component="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (text.trim() && await onSave(item, text.trim())) setEditing(false);
            }}
            sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mt: 1 }}
          >
            <TextField
              size="small"
              fullWidth
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              inputProps={{ 'aria-label': label }}
            />
            <Button type="submit" variant="contained" size="small" disabled={busy || !text.trim()}>{T.SAVE}</Button>
            <Button size="small" onClick={close}>{T.CANCEL}</Button>
          </Box>
        ) : (
          <Typography sx={{ color: '#1a1a2e', fontWeight: 600, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.answer}</Typography>
        )}
        <Typography variant="caption" sx={{ color: '#8a8aa3', display: 'block', mt: 0.25 }}>{usageLine(item)}</Typography>
      </Box>
      {!editing && (
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <Tooltip title={T.EDIT}>
            <IconButton size="small" onClick={() => setEditing(true)} aria-label={`${T.EDIT}: ${label}`} disabled={busy}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={T.DELETE}>
            <IconButton size="small" onClick={() => onDelete(item)} aria-label={`${T.DELETE}: ${label}`} disabled={busy}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

const LearnedAnswersSection = () => {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const { data } = await careerContextAPI.learned();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (item, answer) => {
    setBusy(true); setActionError(false);
    try {
      await careerContextAPI.editLearned(item.id, answer);
      setItems((list) => list.map((x) => (x.id === item.id ? { ...x, answer } : x)));
      return true;
    } catch {
      setActionError(true);
      return false;
    } finally { setBusy(false); }
  };

  const remove = async (item) => {
    setBusy(true); setActionError(false);
    try {
      await careerContextAPI.deleteLearned(item.id);
      setItems((list) => list.filter((x) => x.id !== item.id));
    } catch { setActionError(true); } finally { setBusy(false); }
  };

  const removeAll = async () => {
    setBusy(true); setActionError(false);
    const failed = [];
    for (const it of items) {
      try { await careerContextAPI.deleteLearned(it.id); } catch { failed.push(it.id); }
    }
    setItems((list) => list.filter((x) => failed.includes(x.id)));
    if (failed.length) setActionError(true);
    setBusy(false);
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }} aria-labelledby="learned-heading">
      <Typography id="learned-heading" variant="h6" component="h2" sx={{ fontWeight: 700 }}>{T.TITLE}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: '#4a4a63', fontWeight: 600 }}>{T.PRIVACY}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: '#6c6c86' }}>{T.DEMOGRAPHIC}</Typography>

      {actionError && <Alert severity="error" sx={{ mt: 2 }}>{T.ACTION_ERROR}</Alert>}

      {loadError ? (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={load}>{T.RETRY}</Button>}>
          {T.LOAD_ERROR}
        </Alert>
      ) : items === null ? (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5 }} role="status">
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ color: '#6c6c86' }}>{T.LOADING}</Typography>
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: '#f7f7fb' }}>
          <Typography variant="body2" sx={{ color: '#6c6c86' }}>{T.EMPTY}</Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ mt: 1 }}>
            {items.map((it, i) => (
              <Box key={it.id}>
                {i > 0 && <Divider />}
                <Row item={it} busy={busy} onSave={save} onDelete={remove} />
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Button color="error" variant="outlined" size="small" onClick={() => setConfirmAll(true)} disabled={busy}>
              {T.DELETE_ALL}
            </Button>
          </Box>
        </>
      )}

      <ConfirmModal
        show={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={() => { setConfirmAll(false); removeAll(); }}
        variant="danger"
        title={T.DELETE_ALL_TITLE}
        message={T.DELETE_ALL_BODY}
        confirmText={T.DELETE_ALL_CONFIRM}
        cancelText={T.CANCEL}
      />
    </Paper>
  );
};

export default LearnedAnswersSection;
