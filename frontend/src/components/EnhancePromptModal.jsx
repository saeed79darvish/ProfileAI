import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Alert,
  Collapse,
  alpha,
} from '@mui/material';
import {
  AutoAwesome as StarIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ErrorOutline as WarnIcon,
} from '@mui/icons-material';

// ── Options ──────────────────────────────────────────────────────────────
const DEPARTMENT_OPTIONS = [
  { value: 'engineering', label: 'Engineering / Software' },
  { value: 'sales', label: 'Sales / Marketing / Growth' },
  { value: 'product_ops', label: 'Product / Operations' },
  { value: 'design', label: 'Design / UX / Creative' },
  { value: 'people_legal', label: 'People / HR / Legal' },
  { value: 'finance', label: 'Finance / Data Analytics' },
];

const EXPERIENCE_LEVELS = [
  { value: '0-2', label: '0–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: '10+', label: '10+ years' },
];

// Tone presets — single choice.
const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', hint: 'Clear and confident. Best for most roles.' },
  { value: 'concise', label: 'Concise', hint: 'Short punchy bullets. Senior IC.' },
  { value: 'executive', label: 'Executive', hint: 'Strategic and outcome-led. Leadership.' },
];

// Focus chips — multi-select.
const FOCUS_OPTIONS = [
  { id: 'metrics', label: 'Add metrics & impact' },
  { id: 'leadership', label: 'Emphasize leadership' },
  { id: 'scope', label: 'Show scope & scale' },
  { id: 'verbs', label: 'Stronger action verbs' },
];

// Sections to enhance — all on by default; deselect to skip.
const SECTION_OPTIONS = [
  { id: 'summary', label: 'Summary', defaultOn: true },
  { id: 'experience', label: 'Experience', defaultOn: true },
  { id: 'projects', label: 'Projects', defaultOn: true },
  { id: 'skills', label: 'Skills', defaultOn: false },
];

// ── Tone segmented control ───────────────────────────────────────────────
const ToneSelector = ({ value, onChange }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
    {TONE_OPTIONS.map((opt) => {
      const active = value === opt.value;
      return (
        <Box
          key={opt.value}
          role="radio"
          aria-checked={active}
          tabIndex={0}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(opt.value);
            }
          }}
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: '1.5px solid',
            borderColor: active ? '#6366f1' : '#e5e7eb',
            backgroundColor: active ? alpha('#6366f1', 0.06) : '#fff',
            cursor: 'pointer',
            transition: 'all 0.15s',
            textAlign: 'left',
            '&:hover': { borderColor: active ? '#6366f1' : '#cbd5e1' },
            '&:focus-visible': { outline: '2px solid #6366f1', outlineOffset: 2 },
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, fontSize: 13, color: active ? '#4338ca' : '#1e293b' }}
          >
            {opt.label}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11.5, lineHeight: 1.35 }}>
            {opt.hint}
          </Typography>
        </Box>
      );
    })}
  </Box>
);

const SelectableChip = ({ active, label, onClick }) => (
  <Chip
    label={label}
    clickable
    onClick={onClick}
    sx={{
      height: 32,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      borderRadius: 4,
      backgroundColor: active ? '#dcfce7' : 'transparent',
      color: active ? '#15803d' : '#475569',
      border: `1.5px solid ${active ? '#86efac' : '#d1d5db'}`,
      '&:hover': {
        backgroundColor: active ? '#bbf7d0' : '#f8fafc',
        borderColor: active ? '#4ade80' : '#94a3b8',
      },
    }}
  />
);

// ── Main modal ───────────────────────────────────────────────────────────
const EnhancePromptModal = ({ open, onClose, onEnhance, formData, onGoToExperience }) => {
  // Smart defaults
  const [targetRole, setTargetRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('3-5');
  const [department, setDepartment] = useState('engineering');
  const [tone, setTone] = useState('professional');
  const [focus, setFocus] = useState(new Set(['metrics']));
  const [sections, setSections] = useState(
    new Set(SECTION_OPTIONS.filter((s) => s.defaultOn).map((s) => s.id))
  );
  const [customNote, setCustomNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pre-flight: detect missing inputs that lead to weak AI output.
  const issues = useMemo(() => {
    const out = [];
    const hasExperience = (formData?.experience || []).some(
      (e) => (e?.description || '').trim().length > 10 || (e?.title || '').trim()
    );
    const hasSummary = (formData?.summary || '').trim().length > 0;
    if (!hasExperience) {
      out.push({
        key: 'experience',
        severity: 'error',
        message:
          "Add at least one work experience before enhancing. AI rewrites what you give it — without roles to polish, results will be generic.",
      });
    }
    if (!hasSummary && sections.has('summary')) {
      out.push({
        key: 'summary',
        severity: 'info',
        message:
          "You don't have a summary yet. AI will draft one from your experience — add a rough draft first for the most accurate result.",
      });
    }
    return out;
  }, [formData?.experience, formData?.summary, sections]);

  const blocking = issues.some((i) => i.severity === 'error');

  // Pre-fill target role from current title on open.
  useEffect(() => {
    if (open && formData?.title) {
      setTargetRole((prev) => prev || formData.title);
    }
  }, [open, formData?.title]);

  const toggleFocus = (id) => {
    setFocus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (id) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnhance = () => {
    if (blocking || sections.size === 0) return;
    const parts = [];

    if (targetRole.trim()) parts.push(`Target role: ${targetRole.trim()}`);
    const lvl = EXPERIENCE_LEVELS.find((l) => l.value === experienceLevel);
    if (lvl) parts.push(`Experience level: ${lvl.label}`);
    const dept = DEPARTMENT_OPTIONS.find((d) => d.value === department);
    if (dept) parts.push(`Department: ${dept.label}`);

    const toneOpt = TONE_OPTIONS.find((t) => t.value === tone);
    if (toneOpt) parts.push(`Tone: ${toneOpt.label} — ${toneOpt.hint}`);

    const focusLabels = FOCUS_OPTIONS.filter((f) => focus.has(f.id)).map((f) => f.label);
    if (focusLabels.length) parts.push(`Focus on: ${focusLabels.join(', ')}`);

    const sectionLabels = SECTION_OPTIONS.filter((s) => sections.has(s.id)).map((s) => s.label);
    if (sectionLabels.length) parts.push(`Sections to enhance: ${sectionLabels.join(', ')}`);

    if (customNote.trim()) parts.push(`Additional instructions: ${customNote.trim()}`);

    onEnhance(parts.join('. '));
    handleClose(true);
  };

  const handleClose = (keepValues = false) => {
    if (!keepValues) {
      setCustomNote('');
      setShowAdvanced(false);
    }
    onClose();
  };

  const handleGoToExperience = () => {
    onClose();
    onGoToExperience?.();
  };

  return (
    <Dialog
      open={open}
      onClose={() => handleClose(false)}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { background: '#fff', borderRadius: 3, maxHeight: '90vh' } }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4338ca, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <StarIcon sx={{ fontSize: 22, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
            Enhance with AI
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.3, fontSize: 13 }}>
            A few quick choices for the best result.
          </Typography>
        </Box>
        <IconButton onClick={() => handleClose(false)} size="small" sx={{ color: '#94a3b8' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1, pb: 1.5, px: 3 }}>
        {/* Pre-flight issues */}
        {issues.map((iss) => (
          <Alert
            key={iss.key}
            severity={iss.severity}
            icon={iss.severity === 'error' ? <WarnIcon fontSize="small" /> : undefined}
            action={
              iss.key === 'experience' && onGoToExperience ? (
                <Button
                  size="small"
                  onClick={handleGoToExperience}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Add role
                </Button>
              ) : undefined
            }
            sx={{ mb: 1.5, borderRadius: 2, fontSize: 13 }}
          >
            {iss.message}
          </Alert>
        ))}

        {/* Target role + level + department */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: '#475569', fontWeight: 700, fontSize: 11, letterSpacing: 1 }}
          >
            About the role you're targeting
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.25, mt: 1, mb: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Target role"
              placeholder="e.g. Senior Product Manager"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                sx={{ borderRadius: 2, fontSize: 14 }}
              >
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <MenuItem key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <FormControl size="small" fullWidth>
            <Select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              sx={{ borderRadius: 2, fontSize: 14 }}
            >
              {DEPARTMENT_OPTIONS.map((d) => (
                <MenuItem key={d.value} value={d.value}>
                  {d.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Tone */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: '#475569', fontWeight: 700, fontSize: 11, letterSpacing: 1, mb: 1, display: 'block' }}
          >
            Tone
          </Typography>
          <ToneSelector value={tone} onChange={setTone} />
        </Box>

        {/* Focus */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: '#475569', fontWeight: 700, fontSize: 11, letterSpacing: 1, mb: 1, display: 'block' }}
          >
            What to emphasize
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {FOCUS_OPTIONS.map((f) => (
              <SelectableChip
                key={f.id}
                active={focus.has(f.id)}
                label={f.label}
                onClick={() => toggleFocus(f.id)}
              />
            ))}
          </Box>
        </Box>

        {/* Sections */}
        <Box sx={{ mb: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: '#475569', fontWeight: 700, fontSize: 11, letterSpacing: 1, mb: 1, display: 'block' }}
          >
            Sections to enhance
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {SECTION_OPTIONS.map((s) => (
              <SelectableChip
                key={s.id}
                active={sections.has(s.id)}
                label={s.label}
                onClick={() => toggleSection(s.id)}
              />
            ))}
          </Box>
        </Box>

        {/* Advanced (custom note) */}
        <Box sx={{ mt: 1.5 }}>
          <Button
            onClick={() => setShowAdvanced((v) => !v)}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  transform: showAdvanced ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            }
            sx={{
              textTransform: 'none',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              p: 0,
              '&:hover': { backgroundColor: 'transparent', color: '#1e293b' },
            }}
          >
            Add custom instructions (optional)
          </Button>
          <Collapse in={showAdvanced} timeout="auto">
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="e.g. Don't invent technologies. Keep bullets under 20 words. Prefer US English."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13.5 } }}
            />
          </Collapse>
        </Box>

        {/* Disclaimer */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            borderLeft: '3px solid #f59e0b',
            backgroundColor: '#fffbeb',
          }}
        >
          <Typography variant="body2" sx={{ color: '#78716c', fontSize: 12.5, lineHeight: 1.5 }}>
            AI only rewrites content you've provided. New facts, metrics or
            skills that aren't in your source text are flagged for review.
          </Typography>
        </Box>
      </DialogContent>

      {/* Footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1.25,
          px: 3,
          py: 2,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <Button
          onClick={() => handleClose(false)}
          sx={{ color: '#475569', textTransform: 'none', fontWeight: 500, borderRadius: 2, px: 3 }}
        >
          Cancel
        </Button>
        <Button
          disabled={blocking || sections.size === 0}
          onClick={handleEnhance}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            px: 3,
            borderRadius: 2,
            backgroundColor: '#0f172a',
            color: '#fff',
            '&:hover': { backgroundColor: '#1e293b' },
            '&.Mui-disabled': { backgroundColor: '#e5e7eb', color: '#94a3b8' },
          }}
        >
          {blocking ? 'Add experience first' : 'Enhance now · 1 credit'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default EnhancePromptModal;
