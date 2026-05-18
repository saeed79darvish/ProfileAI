import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Collapse,
  Select,
  MenuItem,
  FormControl,
  alpha,
} from '@mui/material';
import {
  AutoAwesome as StarIcon,
  RadioButtonChecked as RadioCheckedIcon,
  Notes as NotesIcon,
  Remove as MinusIcon,
  ChangeHistory as TriangleIcon,
  RadioButtonUnchecked as CircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// ── Department options (matches backend classifier groups) ───────────────
const DEPARTMENT_OPTIONS = [
  { value: 'engineering', label: 'Engineering / Software Development' },
  { value: 'sales', label: 'Sales / Marketing / Growth' },
  { value: 'product_ops', label: 'Product Management / Operations' },
  { value: 'design', label: 'Design / UX / Creative' },
  { value: 'people_legal', label: 'People / HR / Legal' },
  { value: 'finance', label: 'Finance / Accounting / Data Analytics' },
];

const EXPERIENCE_LEVELS = [
  { value: '0-2', label: '0-2 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '6-10', label: '6-10 years' },
  { value: '10+', label: '10+ years' },
];

// ── Section definitions ──────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'tone',
    label: 'Tone & style',
    Icon: StarIcon,
    groups: [
      {
        label: 'VOICE',
        chips: [
          { id: 'voice_professional', text: 'Professional' },
          { id: 'voice_executive', text: 'Executive' },
          { id: 'voice_technical', text: 'Technical' },
          { id: 'voice_concise', text: 'Concise' },
        ],
      },
      {
        label: 'FOCUS',
        chips: [
          { id: 'focus_achievement', text: 'Achievement-focused' },
          { id: 'focus_leadership', text: 'Leadership focus' },
          { id: 'focus_scope', text: 'Scope & scale' },
          { id: 'focus_innovation', text: 'Innovation focus' },
        ],
      },
    ],
  },
  {
    id: 'summary',
    label: 'Summary',
    Icon: RadioCheckedIcon,
    toggle: {
      label: 'LENGTH',
      stateKey: 'summaryLength',
      options: [
        { value: '1-2', label: '1-2 lines' },
        { value: '3', label: '3 lines (recommended)' },
        { value: '4-5', label: '4-5 lines (exec only)' },
      ],
    },
    groups: [
      {
        label: 'OPTIONS',
        chips: [
          { id: 'summary_achievements', text: 'Add quantifiable achievements' },
          { id: 'summary_seniority', text: 'Emphasize seniority' },
        ],
      },
    ],
  },
  {
    id: 'experience',
    label: 'Experience',
    Icon: NotesIcon,
    toggle: {
      label: 'BULLETS PER ROLE',
      stateKey: 'experienceBullets',
      options: [
        { value: '2-3', label: '2-3' },
        { value: '4-5', label: '4-5 (recommended)' },
        { value: '6+', label: '6+' },
      ],
    },
    groups: [
      {
        label: 'ENHANCEMENTS',
        chips: [
          { id: 'exp_metrics', text: 'Add metrics & KPIs' },
          { id: 'exp_verbs', text: 'Strong action verbs' },
          { id: 'exp_scope', text: 'Show scope & team size' },
          { id: 'exp_weak', text: 'Flag weak bullets' },
        ],
      },
    ],
  },
  {
    id: 'skills',
    label: 'Skills',
    Icon: MinusIcon,
    groups: [
      {
        chips: [
          { id: 'skills_missing', text: 'Suggest missing skills' },
          { id: 'skills_outdated', text: 'Remove outdated skills' },
          { id: 'skills_group', text: 'Group by category' },
        ],
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    Icon: TriangleIcon,
    groups: [
      {
        chips: [
          { id: 'proj_impact', text: 'Problem → solution → impact' },
          { id: 'proj_metrics', text: 'Add impact metrics' },
          { id: 'proj_tech', text: 'Add tech stack details' },
        ],
      },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    Icon: CircleIcon,
    groups: [
      {
        chips: [
          { id: 'edu_coursework', text: 'Highlight relevant coursework' },
          { id: 'edu_certs', text: 'Suggest certifications' },
        ],
      },
    ],
  },
];

// ── Segmented toggle control ─────────────────────────────────────────────
const SegmentedControl = ({ options, value, onChange }) => (
  <Box sx={{ display: 'flex', border: '1.5px solid #d1d5db', borderRadius: 2, overflow: 'hidden' }}>
    {options.map((opt, i) => (
      <Box
        key={opt.value}
        onClick={() => onChange(value === opt.value ? null : opt.value)}
        sx={{
          flex: 1,
          py: 0.85,
          px: 1,
          textAlign: 'center',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: value === opt.value ? 600 : 400,
          color: value === opt.value ? '#15803d' : '#555',
          backgroundColor: value === opt.value ? '#dcfce7' : 'transparent',
          borderRight: i < options.length - 1 ? '1.5px solid #d1d5db' : 'none',
          transition: 'all 0.15s',
          userSelect: 'none',
          '&:hover': { backgroundColor: value === opt.value ? '#bbf7d0' : '#f9fafb' },
        }}
      >
        {opt.label}
      </Box>
    ))}
  </Box>
);

const EnhancePromptModal = ({ open, onClose, onEnhance, formData }) => {
  // ── Context fields ──
  const [targetRole, setTargetRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('6-10');
  const [department, setDepartment] = useState('engineering');

  // ── Enhancement selections ──
  const [selected, setSelected] = useState(new Set());
  const [summaryLength, setSummaryLength] = useState(null);
  const [experienceBullets, setExperienceBullets] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  const toggleChip = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (id) =>
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  // Count selections per section
  const getSectionCount = (section) => {
    const chipIds = section.groups.flatMap((g) => g.chips.map((c) => c.id));
    let count = chipIds.filter((id) => selected.has(id)).length;
    if (section.toggle) {
      const val = section.toggle.stateKey === 'summaryLength' ? summaryLength : experienceBullets;
      if (val) count++;
    }
    return count;
  };

  const totalSelected = useMemo(() => {
    let count = selected.size;
    if (summaryLength) count++;
    if (experienceBullets) count++;
    return count;
  }, [selected, summaryLength, experienceBullets]);

  const handleEnhance = () => {
    const parts = [];

    // Context
    if (targetRole.trim()) parts.push(`Target role: ${targetRole.trim()}`);
    if (experienceLevel) {
      const lvl = EXPERIENCE_LEVELS.find((l) => l.value === experienceLevel);
      parts.push(`Experience level: ${lvl?.label || experienceLevel}`);
    }
    if (department) {
      const dept = DEPARTMENT_OPTIONS.find((d) => d.value === department);
      parts.push(`Department: ${dept?.label || department}`);
    }

    // Chip selections
    const allChips = SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.chips));
    for (const chip of allChips) {
      if (selected.has(chip.id)) parts.push(chip.text);
    }

    // Toggle selections
    if (summaryLength) parts.push(`Keep the summary to ${summaryLength} lines`);
    if (experienceBullets) parts.push(`Write ${experienceBullets} bullet points per role`);

    onEnhance(parts.join('. '));
    resetState();
  };

  const resetState = () => {
    setTargetRole('');
    setExperienceLevel('6-10');
    setDepartment('engineering');
    setSelected(new Set());
    setSummaryLength(null);
    setExperienceBullets(null);
    setExpandedSections({});
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: { background: '#fff', borderRadius: 3, maxHeight: '85vh' },
      }}
    >
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 1.5 }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4338ca, #3730a3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <StarIcon sx={{ fontSize: 22, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>
            Enhance profile
          </Typography>
          <Typography variant="body2" sx={{ color: '#888', lineHeight: 1.3 }}>
            AI will only use your existing experience
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: '#999' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 0.5, pb: 1, px: 3 }}>
        {/* ── TARGET ROLE & CONTEXT ── */}
        <Box
          sx={{
            mb: 2.5, p: 2, borderRadius: 2.5,
            border: '1px solid #e5e7eb', backgroundColor: '#fafafa',
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: '#888', fontWeight: 600, fontSize: 11, letterSpacing: 1, mb: 1.5, display: 'block' }}
          >
            Target role & context
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            {/* Target Role */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 600, fontSize: 10, letterSpacing: 0.5, mb: 0.5, display: 'block' }}>
                TARGET ROLE
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. Staff Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2, fontSize: 14, backgroundColor: '#fff',
                    '& fieldset': { borderColor: '#d1d5db' },
                    '&:hover fieldset': { borderColor: '#9ca3af' },
                    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                  },
                }}
              />
            </Box>

            {/* Experience Level */}
            <Box sx={{ minWidth: 150 }}>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 600, fontSize: 10, letterSpacing: 0.5, mb: 0.5, display: 'block' }}>
                EXPERIENCE LEVEL
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  sx={{
                    borderRadius: 2, fontSize: 14, backgroundColor: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9ca3af' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                  }}
                >
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <MenuItem key={lvl.value} value={lvl.value}>{lvl.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Department */}
          <Typography variant="caption" sx={{ color: '#888', fontWeight: 600, fontSize: 10, letterSpacing: 0.5, mb: 0.5, display: 'block' }}>
            DEPARTMENT
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              sx={{
                borderRadius: 2, fontSize: 14, backgroundColor: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9ca3af' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
              }}
            >
              {DEPARTMENT_OPTIONS.map((d) => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* ── Enhancement sections ── */}
        {SECTIONS.map((section) => {
          const { Icon } = section;
          const isExpanded = !!expandedSections[section.id];
          const activeCount = getSectionCount(section);

          return (
            <Box key={section.id} sx={{ mb: 0.5 }}>
              {/* Section divider */}
              <Box sx={{ borderTop: '1px solid #f0f0f0' }} />

              {/* Section header */}
              <Box
                onClick={() => toggleSection(section.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  py: 1.5, cursor: 'pointer', userSelect: 'none',
                  '&:hover': { opacity: 0.8 },
                }}
              >
                <Icon sx={{ fontSize: 20, color: '#4b5563', flexShrink: 0 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1, color: '#1a1a2e', fontSize: 15 }}>
                  {section.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: activeCount > 0 ? '#16a34a' : '#9ca3af',
                    fontWeight: 500, fontSize: 12, mr: 0.5,
                  }}
                >
                  {activeCount > 0 ? `${activeCount} selected` : 'none selected'}
                </Typography>
                <Typography sx={{ color: '#9ca3af', fontSize: 8, lineHeight: 1 }}>
                  {isExpanded ? '▲' : '▼'}
                </Typography>
              </Box>

              {/* Section content */}
              <Collapse in={isExpanded} timeout="auto">
                <Box sx={{ pb: 2 }}>
                  {/* Toggle control (summary length / bullets per role) */}
                  {section.toggle && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="caption"
                        sx={{ color: '#888', fontWeight: 600, fontSize: 10, letterSpacing: 0.5, mb: 0.8, display: 'block' }}
                      >
                        {section.toggle.label}
                      </Typography>
                      <SegmentedControl
                        options={section.toggle.options}
                        value={section.toggle.stateKey === 'summaryLength' ? summaryLength : experienceBullets}
                        onChange={(val) => {
                          if (section.toggle.stateKey === 'summaryLength') setSummaryLength(val);
                          else setExperienceBullets(val);
                        }}
                      />
                    </Box>
                  )}

                  {/* Chip groups */}
                  {section.groups.map((group, gi) => (
                    <Box key={gi} sx={{ mb: gi < section.groups.length - 1 ? 1.5 : 0 }}>
                      {group.label && (
                        <Typography
                          variant="caption"
                          sx={{ color: '#888', fontWeight: 600, fontSize: 10, letterSpacing: 0.5, mb: 0.8, display: 'block' }}
                        >
                          {group.label}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                        {group.chips.map((chip) => {
                          const isActive = selected.has(chip.id);
                          return (
                            <Chip
                              key={chip.id}
                              label={chip.text}
                              clickable
                              onClick={() => toggleChip(chip.id)}
                              sx={{
                                height: 32, fontSize: 13, fontWeight: isActive ? 600 : 400,
                                borderRadius: 4,
                                backgroundColor: isActive ? '#dcfce7' : 'transparent',
                                color: isActive ? '#16a34a' : '#555',
                                border: `1.5px solid ${isActive ? '#86efac' : '#d1d5db'}`,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  backgroundColor: isActive ? '#bbf7d0' : '#f5f5f5',
                                  borderColor: isActive ? '#4ade80' : '#9ca3af',
                                },
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}

        {/* ── Disclaimer ── */}
        <Box
          sx={{
            mt: 2, p: 1.5, borderRadius: 2,
            borderLeft: '3px solid #f59e0b', backgroundColor: '#fffbeb',
          }}
        >
          <Typography variant="body2" sx={{ color: '#78716c', fontSize: 12.5, lineHeight: 1.5 }}>
            AI rewrites content based on the experience you've already provided.
            We run an automatic grounding check and flag any new skills, metrics,
            or achievements that don't appear in your source text — but please
            review every change before saving.
          </Typography>
        </Box>
      </DialogContent>

      {/* ── Footer ── */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 3, py: 2, borderTop: '1px solid #f0f0f0',
        }}
      >
        <Button
          onClick={handleClose}
          sx={{
            color: '#555', textTransform: 'none', fontWeight: 500,
            borderRadius: 2, border: '1px solid #d1d5db', px: 3,
            '&:hover': { backgroundColor: '#f5f5f5', borderColor: '#9ca3af' },
          }}
        >
          Cancel
        </Button>

        <Typography variant="body2" sx={{ color: totalSelected > 0 ? '#9ca3af' : '#ef4444', fontSize: 13 }}>
          {totalSelected > 0
            ? `${totalSelected} enhancement${totalSelected !== 1 ? 's' : ''} selected`
            : 'Select at least one section to continue'}
        </Typography>

        <Button
          disabled={totalSelected === 0}
          onClick={handleEnhance}
          sx={{
            textTransform: 'none', fontWeight: 600, px: 3, borderRadius: 2,
            backgroundColor: totalSelected > 0 ? '#1a1a2e' : '#e5e7eb',
            color: totalSelected > 0 ? '#fff' : '#999',
            '&:hover': { backgroundColor: '#2d2d44' },
            '&.Mui-disabled': { backgroundColor: '#e5e7eb', color: '#999' },
          }}
        >
          Enhance now
        </Button>
      </Box>
    </Dialog>
  );
};

export default EnhancePromptModal;
