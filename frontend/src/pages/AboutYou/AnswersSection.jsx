import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Typography, Box, Button, TextField, IconButton, Chip, Divider, Tooltip,
} from '@mui/material';
import { EditOutlined as EditIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';

import { careerContextAPI } from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal';
import { STATIC_ANSWER_CATALOG, MEMORY_FACT_IDS } from '../ProfileCoach/answerCatalog';
import { ANSWERS_TEXT as T } from './constants';

/**
 * "Answers I can give for you": the facts and stories the person told us for
 * application questions. Each one can be edited in place or deleted, and all
 * of it can go at once. Saved with PATCH /career-context (null deletes).
 * Never shows or asks for demographic answers; the catalog has none.
 */

const choicesOf = (item) => {
  if (item.kind === 'story') return null;
  if (Array.isArray(item.choices) && item.choices.length) return item.choices;
  if (item.type === 'yesno') return [{ value: 'yes', label: T.YES }, { value: 'no', label: T.NO }];
  return null;
};

const shown = (item, entry) => {
  if (!entry) return '';
  if (item.kind === 'story') return entry.text || '';
  const choice = choicesOf(item)?.find((c) => c.value === entry.value);
  const base = choice ? choice.label : entry.value || '';
  return entry.note ? `${base}. ${entry.note}` : base;
};

const AnswerRow = ({ item, entry, startEditing = false, busy, onSave, onDelete, onClose }) => {
  const [editing, setEditing] = useState(startEditing);
  const [text, setText] = useState(item.kind === 'story' ? entry?.text || '' : entry?.value || '');
  const choices = choicesOf(item);
  const done = () => { setEditing(false); onClose?.(); };

  return (
    <Box sx={{ py: 1.75, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Typography
        variant="caption"
        sx={{ flex: '0 0 150px', pt: 0.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#8a8aa3' }}
      >
        {item.label || item.id}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editing && choices ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.ask && <Typography variant="body2" sx={{ width: '100%', color: '#6c6c86' }}>{item.ask}</Typography>}
            {choices.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                clickable
                disabled={busy}
                color={entry?.value === c.value ? 'primary' : 'default'}
                onClick={() => { onSave(c.value); done(); }}
              />
            ))}
            <Button size="small" onClick={done}>{T.CANCEL}</Button>
          </Box>
        ) : editing ? (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) onSave(text.trim());
              done();
            }}
            sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}
          >
            {item.ask && <Typography variant="body2" sx={{ width: '100%', color: '#6c6c86' }}>{item.ask}</Typography>}
            <TextField
              size="small"
              fullWidth
              multiline={item.kind === 'story'}
              minRows={item.kind === 'story' ? 3 : undefined}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              inputProps={{ 'aria-label': item.label || item.id }}
              sx={{ flex: 1, minWidth: 220 }}
            />
            <Button type="submit" variant="contained" size="small" disabled={busy || !text.trim()}>{T.SAVE}</Button>
            <Button size="small" onClick={done}>{T.CANCEL}</Button>
          </Box>
        ) : (
          <Typography sx={{ color: entry ? '#1a1a2e' : '#a0a0b8', fontStyle: entry ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
            {entry ? shown(item, entry) : T.NOT_ANSWERED}
          </Typography>
        )}
      </Box>
      {!editing && (
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <Tooltip title={T.EDIT}>
            <IconButton size="small" onClick={() => setEditing(true)} aria-label={`${T.EDIT} ${item.label || item.id}`} disabled={busy}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {entry && (
            <Tooltip title={T.DELETE}>
              <IconButton size="small" onClick={onDelete} aria-label={`${T.DELETE} ${item.label || item.id}`} disabled={busy}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

const AnswersSection = ({ context, busy, run }) => {
  const [catalog, setCatalog] = useState(STATIC_ANSWER_CATALOG);
  const [adding, setAdding] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    careerContextAPI.answerCatalog()
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data?.facts) && Array.isArray(data?.stories)) setCatalog(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const facts = context?.answerFacts || {};
  const stories = context?.answerStories || {};

  /* Everything in the catalog, plus any saved id the catalog no longer
     lists, so nothing stored is ever hidden from the person it belongs to. */
  const items = useMemo(() => {
    const f = catalog.facts.map((x) => ({ ...x, kind: 'fact' }));
    const s = catalog.stories.map((x) => ({ ...x, kind: 'story' }));
    Object.keys(facts).forEach((id) => { if (!f.some((x) => x.id === id)) f.push({ id, label: id, kind: 'fact', type: 'text' }); });
    Object.keys(stories).forEach((id) => { if (!s.some((x) => x.id === id)) s.push({ id, label: id, kind: 'story', type: 'text' }); });
    return { facts: f, stories: s };
  }, [catalog, facts, stories]);

  const answeredFacts = items.facts.filter((x) => facts[x.id]);
  const answeredStories = items.stories.filter((x) => stories[x.id]);
  const hasAnswers = answeredFacts.length + answeredStories.length > 0;
  const open = [
    ...items.facts.filter((x) => !facts[x.id]),
    ...items.stories.filter((x) => !stories[x.id]),
  ];
  // The empty state offers the five that matter most; later, anything left.
  const offered = hasAnswers ? open : open.filter((x) => x.kind === 'fact' && MEMORY_FACT_IDS.includes(x.id));

  const save = (item, value) => run(
    () => careerContextAPI.edit(item.kind === 'story'
      ? { answerStories: { [item.id]: { text: value } } }
      : { answerFacts: { [item.id]: { value } } }),
    'answer_save',
  );
  const remove = (item) => run(
    () => careerContextAPI.edit(item.kind === 'story'
      ? { answerStories: { [item.id]: null } }
      : { answerFacts: { [item.id]: null } }),
    'answer_delete',
  );
  const removeAll = () => run(() => careerContextAPI.edit({
    answerFacts: Object.fromEntries(Object.keys(facts).map((id) => [id, null])),
    answerStories: Object.fromEntries(Object.keys(stories).map((id) => [id, null])),
  }), 'answer_delete_all');

  const group = (title, list, type) => !!list.length && (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ color: '#6c6c86', mt: 1.5 }}>{title}</Typography>
      {list.map((item, i) => (
        <Box key={item.id}>
          {i > 0 && <Divider />}
          <AnswerRow
            item={item}
            entry={type === 'story' ? stories[item.id] : facts[item.id]}
            busy={busy}
            onSave={(v) => save(item, v)}
            onDelete={() => remove(item)}
          />
        </Box>
      ))}
    </Box>
  );

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }} aria-labelledby="answers-heading">
      <Typography id="answers-heading" variant="h6" component="h2" sx={{ fontWeight: 700 }}>{T.TITLE}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: '#4a4a63', fontWeight: 600 }}>{T.PRIVACY}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: '#6c6c86' }}>{T.INTRO}</Typography>

      {hasAnswers ? (
        <>
          {group(T.FACTS, answeredFacts, 'fact')}
          {group(T.STORIES, answeredStories, 'story')}
        </>
      ) : (
        <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: '#f7f7fb' }}>
          <Typography sx={{ fontWeight: 600, color: '#1a1a2e' }}>{T.EMPTY_TITLE}</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: '#6c6c86' }}>{T.EMPTY_BODY}</Typography>
        </Box>
      )}

      {!!offered.length && (
        <Box sx={{ mt: 2 }}>
          <Button variant={hasAnswers ? 'outlined' : 'contained'} size="small" onClick={() => setAdding((v) => !v)} disabled={busy}>
            {adding ? T.HIDE : (hasAnswers ? T.ADD : T.EMPTY_CTA)}
          </Button>
          {adding && offered.map((item, i) => (
            <Box key={item.id}>
              {i > 0 && <Divider />}
              <AnswerRow
                item={item}
                entry={null}
                startEditing
                busy={busy}
                onSave={(v) => save(item, v)}
                onDelete={() => {}}
              />
            </Box>
          ))}
        </Box>
      )}

      {hasAnswers && (
        <Box sx={{ mt: 2 }}>
          <Button color="error" variant="outlined" size="small" onClick={() => setConfirmAll(true)} disabled={busy}>
            {T.DELETE_ALL}
          </Button>
        </Box>
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

export default AnswersSection;
