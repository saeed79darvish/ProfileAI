import React, { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { AutoAwesome as AIIcon } from '@mui/icons-material';
import NoteField from '@/components/flow/NoteField';
import { profileAPI } from '@/services/api';

/*
 * Smart add: say or type one sentence about an entry and the fields below are
 * filled in for review. The sentence goes to the server's parser, which returns
 * the same fields the form has; the page puts them in the real inputs. Nothing
 * is saved here, and nothing already typed is overwritten (the page decides).
 * Free: it uses the assist bucket, never an Enhance credit.
 */

const PROMPTS = {
  education: {
    title: 'Describe it in one line',
    hint: 'We fill the school, degree, field and dates for you to check.',
    placeholder: 'e.g. UC Santa Cruz Silicon Valley, software engineering, 2022 to 2024',
    label: 'Describe this education in one sentence',
  },
  experience: {
    title: 'Describe the role in a sentence or two',
    hint: 'We fill the company, title, type, location, dates, description and skills for you to check.',
    placeholder: 'e.g. Software engineer at Autodesk, full time, June 2021 to August 2023, built serverless apps with React and AWS',
    label: 'Describe this role in a sentence',
  },
  project: {
    title: 'Describe the project in a sentence or two',
    hint: 'We fill the title, role, description, technologies and dates for you to check.',
    placeholder: 'e.g. Recipe finder app I built with Next.js and Postgres last year, github.com/me/recipes',
    label: 'Describe this project in a sentence',
  },
  skills: {
    title: 'Say or type your skills',
    hint: 'A list or a sentence works. We add each skill as its own chip.',
    placeholder: 'e.g. Python, SQL, some Figma and a lot of stakeholder management',
    label: 'List your skills in a sentence',
  },
};

export default function SmartFillBar({
  kind,
  onApply,
  beforeRun,
  onLimit,
  hints = '',
  compact = false,
  buttonLabel = 'Fill the fields',
}) {
  const copy = PROMPTS[kind];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (busy || text.trim().length < 3) return;
    if (beforeRun && !beforeRun()) return;
    setBusy(true);
    setError('');
    try {
      const response = await profileAPI.smartFill(kind, text.trim());
      const item = response.data?.item;
      if (!item) throw new Error('empty');
      onApply(item);
      setText('');
    } catch (err) {
      if (err?.response?.status === 429 && onLimit) onLimit(err);
      else setError(err?.response?.data?.error || 'Could not read that. Try again, or fill the fields yourself.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      role="group"
      aria-label={copy.label}
      sx={{
        mb: 2,
        p: compact ? 1.25 : 1.75,
        borderRadius: 2,
        border: '1px dashed #c7d2fe',
        backgroundColor: '#f5f3ff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AIIcon sx={{ color: '#6366f1', fontSize: 18 }} />
        <Typography variant="subtitle2" sx={{ color: '#3730a3', fontWeight: 700 }}>{copy.title}</Typography>
      </Box>
      {!compact && (
        <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 0.25 }}>{copy.hint}</Typography>
      )}
      <NoteField
        value={text}
        onChange={(v) => { setText(v); if (error) setError(''); }}
        placeholder={copy.placeholder}
        label={copy.label}
        hints={hints}
        maxLength={600}
        multiline={!compact}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, mt: 1 }}>
        <Button
          type="button"
          onClick={run}
          disabled={busy || text.trim().length < 3}
          size="small"
          startIcon={busy ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AIIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 12.5,
            px: 1.75,
            borderRadius: 1.5,
            color: '#fff',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
            '&.Mui-disabled': { background: '#e2e8f0', color: '#94a3b8' },
          }}
        >
          {busy ? 'Reading...' : buttonLabel}
        </Button>
      </Box>
      {error && <Alert severity="warning" sx={{ mt: 1 }} role="alert">{error}</Alert>}
    </Box>
  );
}
