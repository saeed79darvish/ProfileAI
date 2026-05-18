import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Collapse,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  AutoAwesome as StarIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
  TipsAndUpdates as TipIcon,
} from '@mui/icons-material';

/**
 * EnhancementPreviewModal, shows a side-by-side comparison of original vs
 * AI-enhanced profile data and lets the user pick which sections to keep.
 *
 * Props
 * -----
 *  open            boolean
 *  onClose         () => void         , discard everything
 *  onApply         (selectedSections: Record<string,boolean>, saveNow: boolean) => void
 *  enhancements    object | null      , AI-returned data
 *  originalData    object             , current profile / form data
 *  saving          boolean            , show spinner on Save button
 *  showApplyOnly   boolean            , hide "Apply & Save" (used by Dashboard which saves itself)
 */
const EnhancementPreviewModal = ({
  open,
  onClose,
  onApply,
  enhancements,
  originalData,
  saving = false,
  showApplyOnly = false,
}) => {
  const defaultSections = { title: true, summary: true, skills: true, experience: true, education: true, projects: true };
  const [sections, setSections] = useState(defaultSections);
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => setSections((s) => ({ ...s, [key]: !s[key] }));
  const toggleExpand = (key) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  const selectedCount = useMemo(() => Object.values(sections).filter(Boolean).length, [sections]);
  const totalCount = Object.keys(sections).length;

  // Flatten skills helper (works with both array and object)
  const flatSkills = (skills) => {
    if (!skills) return [];
    if (Array.isArray(skills)) return skills;
    if (typeof skills === 'object') return Object.values(skills).flat().filter(Boolean);
    return [];
  };

  const handleClose = () => {
    setSections(defaultSections);
    setExpanded({});
    onClose();
  };

  if (!enhancements) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
    >
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 1 }}>
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
            AI Enhanced Profile Preview
          </Typography>
          <Typography variant="body2" sx={{ color: '#888' }}>
            Select which sections to keep
          </Typography>
        </Box>
        <Chip
          label={`${selectedCount} of ${totalCount} sections`}
          size="small"
          sx={{ fontWeight: 600, backgroundColor: '#ede9fe', color: '#6d28d9' }}
        />
        <IconButton onClick={handleClose} size="small" sx={{ color: '#999' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent dividers sx={{ px: 3 }}>
        {/* ── Title ── */}
        {enhancements.title && (
          <SectionBlock
            label="Professional Title"
            checked={sections.title}
            onToggle={() => toggle('title')}
          >
            <CompareRow
              original={originalData?.title || '(No title)'}
              enhanced={enhancements.title}
            />
          </SectionBlock>
        )}

        {/* ── Summary ── */}
        {enhancements.summary && (
          <SectionBlock
            label="Professional Summary"
            checked={sections.summary}
            onToggle={() => toggle('summary')}
          >
            <CompareRow
              original={originalData?.summary || '(No summary)'}
              enhanced={enhancements.summary}
              multiline
            />
          </SectionBlock>
        )}

        {/* ── Skills ── */}
        {flatSkills(enhancements.skills).length > 0 && (
          <SectionBlock
            label={`Skills (${flatSkills(enhancements.skills).length} total)`}
            checked={sections.skills}
            onToggle={() => toggle('skills')}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: '#f9fafb', height: '100%' }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>ORIGINAL</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {flatSkills(originalData?.skills).map((s, i) => (
                      <Chip key={i} label={s} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    ))}
                    {flatSkills(originalData?.skills).length === 0 && (
                      <Typography variant="body2" color="text.secondary">(No skills)</Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: '#f0fdf4', border: '2px solid #86efac', height: '100%' }}>
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700 }} display="block" gutterBottom>✨ ENHANCED</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {flatSkills(enhancements.skills).map((s, i) => (
                      <Chip key={i} label={typeof s === 'object' ? s.name || s : s} size="small" color="success" variant="outlined" sx={{ fontSize: 11 }} />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </SectionBlock>
        )}

        {/* ── Experience ── */}
        {enhancements.experience?.length > 0 && (
          <SectionBlock
            label={`Experience (${enhancements.experience.length} entries)`}
            checked={sections.experience}
            onToggle={() => toggle('experience')}
            collapsible
            isExpanded={!!expanded.experience}
            onToggleExpand={() => toggleExpand('experience')}
          >
            <Collapse in={!!expanded.experience} timeout="auto" unmountOnExit>
              {enhancements.experience.map((exp, i) => (
                <Paper key={i} sx={{ p: 2, mt: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#15803d' }}>
                    {exp.title} at {exp.company}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{exp.period}</Typography>
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{exp.description}</Typography>
                </Paper>
              ))}
            </Collapse>
          </SectionBlock>
        )}

        {/* ── Education ── */}
        {enhancements.education?.length > 0 && (
          <SectionBlock
            label={`Education (${enhancements.education.length} entries)`}
            checked={sections.education}
            onToggle={() => toggle('education')}
            collapsible
            isExpanded={!!expanded.education}
            onToggleExpand={() => toggleExpand('education')}
          >
            <Collapse in={!!expanded.education} timeout="auto" unmountOnExit>
              {enhancements.education.map((edu, i) => (
                <Paper key={i} sx={{ p: 2, mt: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#15803d' }}>
                    {edu.degree || edu.field}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{edu.institution}</Typography>
                  <Typography variant="caption" color="text.secondary">{edu.year || edu.period}</Typography>
                </Paper>
              ))}
            </Collapse>
          </SectionBlock>
        )}

        {/* ── Projects ── */}
        {enhancements.projects?.length > 0 && (
          <SectionBlock
            label={`Projects (${enhancements.projects.length} entries)`}
            checked={sections.projects}
            onToggle={() => toggle('projects')}
            collapsible
            isExpanded={!!expanded.projects}
            onToggleExpand={() => toggleExpand('projects')}
          >
            <Collapse in={!!expanded.projects} timeout="auto" unmountOnExit>
              {enhancements.projects.map((proj, i) => (
                <Paper key={i} sx={{ p: 2, mt: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#15803d' }}>
                    {proj.title || proj.name}
                  </Typography>
                  {proj.role && <Typography variant="caption" color="text.secondary">Role: {proj.role}</Typography>}
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{proj.description}</Typography>
                  {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {proj.technologies.map((t, j) => (
                        <Chip key={j} label={t} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                      ))}
                    </Box>
                  )}
                </Paper>
              ))}
            </Collapse>
          </SectionBlock>
        )}

        {/* ── Enhancement Notes ── */}
        {enhancements.enhancements && (
          <Box sx={{ mt: 3, p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #93c5fd' }}>
            <Typography variant="subtitle2" sx={{ color: '#1e40af', fontWeight: 700, mb: 1 }}>
              📝 What was improved
            </Typography>
            {enhancements.enhancements.summaryChanges && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Summary:</strong> {enhancements.enhancements.summaryChanges}
              </Typography>
            )}
            {enhancements.enhancements.experienceChanges && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Experience:</strong> {enhancements.enhancements.experienceChanges}
              </Typography>
            )}
            {enhancements.enhancements.skillsChanges && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Skills:</strong> {enhancements.enhancements.skillsChanges}
              </Typography>
            )}
            {enhancements.enhancements.overallTips?.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" fontWeight="bold">💡 Additional Tips:</Typography>
                <List dense disablePadding>
                  {enhancements.enhancements.overallTips.map((tip, i) => (
                    <ListItem key={i} sx={{ py: 0, px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <TipIcon fontSize="small" sx={{ color: '#f59e0b' }} />
                      </ListItemIcon>
                      <ListItemText primary={tip} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      {/* ── Footer ── */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center',
          px: 3, py: 2, borderTop: '1px solid #f0f0f0', gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          {selectedCount} of {totalCount} sections selected
        </Typography>
        <Button
          onClick={handleClose}
          sx={{ color: '#555', textTransform: 'none', fontWeight: 500, borderRadius: 2, border: '1px solid #d1d5db', px: 2.5 }}
        >
          Keep Original
        </Button>
        {!showApplyOnly && (
          <Button
            variant="outlined"
            onClick={() => { onApply(sections, false); handleClose(); }}
            startIcon={<CheckIcon />}
            disabled={selectedCount === 0}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2.5 }}
          >
            Apply & Review
          </Button>
        )}
        <Button
          onClick={() => { onApply(sections, true); handleClose(); }}
          disabled={saving || selectedCount === 0}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />}
          sx={{
            textTransform: 'none', fontWeight: 600, px: 3, borderRadius: 2,
            backgroundColor: '#1a1a2e', color: '#fff',
            '&:hover': { backgroundColor: '#2d2d44' },
            '&.Mui-disabled': { backgroundColor: '#e5e7eb', color: '#999' },
          }}
        >
          {saving ? 'Saving…' : 'Apply & Save'}
        </Button>
      </Box>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Labeled section with checkbox + optional collapse */
const SectionBlock = ({ label, checked, onToggle, children, collapsible, isExpanded, onToggleExpand }) => (
  <Box sx={{ mb: 3, opacity: checked ? 1 : 0.45, transition: 'opacity 0.2s' }}>
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={onToggle} sx={{ color: '#6d28d9', '&.Mui-checked': { color: '#6d28d9' } }} />}
      label={
        collapsible ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
            onClick={(e) => { e.preventDefault(); onToggleExpand?.(); }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#4338ca' }}>{label}</Typography>
            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>
        ) : (
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#4338ca' }}>{label}</Typography>
        )
      }
    />
    {children}
  </Box>
);

/** Original vs Enhanced side-by-side */
const CompareRow = ({ original, enhanced, multiline }) => (
  <Grid container spacing={2}>
    <Grid item xs={12} md={6}>
      <Paper sx={{ p: 2, bgcolor: '#f9fafb', height: '100%' }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>ORIGINAL</Typography>
        <Typography variant={multiline ? 'body2' : 'body1'}>{original}</Typography>
      </Paper>
    </Grid>
    <Grid item xs={12} md={6}>
      <Paper sx={{ p: 2, bgcolor: '#f0fdf4', border: '2px solid #86efac', height: '100%' }}>
        <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700 }} display="block" gutterBottom>✨ ENHANCED</Typography>
        <Typography variant={multiline ? 'body2' : 'body1'} fontWeight="medium">{enhanced}</Typography>
      </Paper>
    </Grid>
  </Grid>
);

export default EnhancementPreviewModal;
