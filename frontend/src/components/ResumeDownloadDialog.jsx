import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  DriveFileRenameOutline as RenameIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Description as WordIcon,
} from '@mui/icons-material';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { resumeAPI, profileAPI } from '../services/api';

const ResumeDownloadDialog = ({ open, onClose, tailoredProfileId = null, tailoredJobTitle = null, userName = '' }) => {
  const [activeTab, setActiveTab] = useState(0); // 0 = preview, 1 = edit
  const [downloading, setDownloading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [editData, setEditData] = useState(null);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [format, setFormat] = useState('pdf');

  // Load profile data when dialog opens
  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    setDownloading(false);
    setActiveTab(0);
    setPreviewDirty(false);
    setPreviewUrl('');

    const namePart = userName ? userName.replace(/\s+/g, '_') : 'Resume';
    const jobPart = tailoredJobTitle ? `_${tailoredJobTitle.replace(/\s+/g, '_')}` : '';
    setFileName(`${namePart}${jobPart}_Resume`);

    loadInitialData();
  }, [open, tailoredProfileId]);

  const loadInitialData = async () => {
    setLoadingProfile(true);
    try {
      if (!tailoredProfileId) {
        const { data } = await profileAPI.getMyProfile();
        const pd = {
          summary: data.summary || '',
          skills: Array.isArray(data.skills) ? data.skills : [],
          experience: Array.isArray(data.experience) ? data.experience : [],
          education: Array.isArray(data.education) ? data.education : [],
          projects: Array.isArray(data.projects) ? data.projects : [],
          title: data.title || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedinUrl: data.linkedinUrl || '',
          githubUrl: data.githubUrl || '',
          portfolioUrl: data.portfolioUrl || '',
        };
        setEditData(pd);
      } else {
        setEditData(null);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoadingProfile(false);
    }
    loadPreview();
  };

  const loadPreview = useCallback(async (data = null) => {
    setLoadingPreview(true);
    try {
      const res = await resumeAPI.preview(
        'professional',
        data ? null : tailoredProfileId,
        data || null
      );
      setPreviewUrl(res.data.preview);
      setPreviewDirty(false);
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  }, [tailoredProfileId]);

  const handleRefreshPreview = () => {
    if (editData && !tailoredProfileId) {
      loadPreview(editData);
    } else {
      loadPreview();
    }
  };

  // Section edit helpers
  const updateField = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    setPreviewDirty(true);
  };

  const updateExperience = (index, field, value) => {
    setEditData(prev => {
      const exp = [...prev.experience];
      exp[index] = { ...exp[index], [field]: value };
      return { ...prev, experience: exp };
    });
    setPreviewDirty(true);
  };

  const addExperience = () => {
    setEditData(prev => ({
      ...prev,
      experience: [...prev.experience, { company: '', title: '', period: '', description: '' }]
    }));
    setPreviewDirty(true);
  };

  const removeExperience = (index) => {
    setEditData(prev => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index)
    }));
    setPreviewDirty(true);
  };

  const updateEducation = (index, field, value) => {
    setEditData(prev => {
      const edu = [...prev.education];
      edu[index] = { ...edu[index], [field]: value };
      return { ...prev, education: edu };
    });
    setPreviewDirty(true);
  };

  const addEducation = () => {
    setEditData(prev => ({
      ...prev,
      education: [...prev.education, { school: '', degree: '', field: '', year: '' }]
    }));
    setPreviewDirty(true);
  };

  const removeEducation = (index) => {
    setEditData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
    setPreviewDirty(true);
  };

  const updateProject = (index, field, value) => {
    setEditData(prev => {
      const proj = [...prev.projects];
      proj[index] = { ...proj[index], [field]: value };
      return { ...prev, projects: proj };
    });
    setPreviewDirty(true);
  };

  const addProject = () => {
    setEditData(prev => ({
      ...prev,
      projects: [...prev.projects, { title: '', description: '', technologies: [] }]
    }));
    setPreviewDirty(true);
  };

  const removeProject = (index) => {
    setEditData(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index)
    }));
    setPreviewDirty(true);
  };

  const updateSkills = (value) => {
    const skills = value.split(',').map(s => s.trim()).filter(Boolean);
    updateField('skills', skills);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    setSuccess('');

    try {
      const dataToSend = editData && !tailoredProfileId ? editData : null;
      const response = await resumeAPI.generate(format, 'professional', tailoredProfileId, dataToSend);

      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const ext = format === 'pdf' ? 'pdf' : 'docx';
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const safeName = (fileName || 'Resume').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'Resume';
      link.setAttribute('download', `${safeName}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error('Download error:', err);
      setError(err.response?.data?.message || 'Failed to download resume. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const canEdit = editData && !tailoredProfileId;

  return (
    <Dialog
      open={open}
      onClose={downloading ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, height: '90vh', maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        py: 1.5,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon />
          <Typography variant="h6" fontSize={18}>
            Resume
            {tailoredJobTitle && (
              <Typography component="span" variant="body2" sx={{ ml: 1, opacity: 0.9 }}>
               , {tailoredJobTitle}
              </Typography>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {canEdit && (
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                minHeight: 36,
                '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', minHeight: 36, py: 0.5, fontSize: 13 },
                '& .Mui-selected': { color: '#fff' },
                '& .MuiTabs-indicator': { backgroundColor: '#fff' },
              }}
            >
              <Tab icon={<PreviewIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Preview" />
              <Tab icon={<EditIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Edit" />
            </Tabs>
          )}
          <IconButton onClick={onClose} disabled={downloading} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ m: 2, mb: 0 }}>{success}</Alert>}

        {/* Preview Tab */}
        {activeTab === 0 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* File Name Row */}
            <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                size="small"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter file name"
                InputProps={{
                  startAdornment: <InputAdornment position="start"><RenameIcon fontSize="small" color="action" /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><Typography variant="body2" color="text.secondary">.{format === 'pdf' ? 'pdf' : 'docx'}</Typography></InputAdornment>,
                }}
                sx={{ flex: 1, maxWidth: 400 }}
              />
              <ToggleButtonGroup
                value={format}
                exclusive
                onChange={(_, v) => { if (v) setFormat(v); }}
                size="small"
              >
                <ToggleButton value="pdf" sx={{ textTransform: 'none', gap: 0.5 }}>
                  <PdfIcon fontSize="small" /> PDF
                </ToggleButton>
                <ToggleButton value="docx" sx={{ textTransform: 'none', gap: 0.5 }}>
                  <WordIcon fontSize="small" /> Word
                </ToggleButton>
              </ToggleButtonGroup>
              {previewDirty && (
                <Button size="small" startIcon={<RefreshIcon />} onClick={handleRefreshPreview} variant="outlined">
                  Update Preview
                </Button>
              )}
            </Box>

            {/* PDF Preview */}
            <Box sx={{ flex: 1, m: 2, mt: 1, borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0', bgcolor: '#f5f5f5', position: 'relative', minHeight: 300 }}>
              {loadingPreview || loadingProfile ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={40} sx={{ color: '#667eea', mb: 2 }} />
                    <Typography color="text.secondary">Generating preview...</Typography>
                  </Box>
                </Box>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  title="Resume Preview"
                  style={{ width: '100%', height: '100%', border: 'none', minHeight: 500 }}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
                  <Typography color="text.secondary">Preview not available</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Edit Tab */}
        {activeTab === 1 && canEdit && (
          <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
            {/* Summary */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">📝 Summary</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth multiline rows={4}
                  value={editData.summary}
                  onChange={(e) => updateField('summary', e.target.value)}
                  placeholder="Write a professional summary..."
                  size="small"
                />
              </AccordionDetails>
            </Accordion>

            {/* Skills */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">🛠 Skills</Typography>
                <Chip label={editData.skills.length} size="small" sx={{ ml: 1 }} />
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth multiline rows={2}
                  value={editData.skills.map(s => typeof s === 'string' ? s : s.name || '').join(', ')}
                  onChange={(e) => updateSkills(e.target.value)}
                  placeholder="JavaScript, React, Node.js, ..."
                  size="small"
                  helperText="Separate skills with commas"
                />
              </AccordionDetails>
            </Accordion>

            {/* Experience */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">💼 Experience</Typography>
                <Chip label={editData.experience.length} size="small" sx={{ ml: 1 }} />
              </AccordionSummary>
              <AccordionDetails>
                {editData.experience.map((exp, i) => (
                  <Box key={i} sx={{ mb: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 2, border: '1px solid #e5e7eb', position: 'relative' }}>
                    <IconButton size="small" onClick={() => removeExperience(i)} sx={{ position: 'absolute', top: 4, right: 4 }}>
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField size="small" label="Company" value={exp.company || ''} onChange={(e) => updateExperience(i, 'company', e.target.value)} sx={{ flex: 1 }} />
                      <TextField size="small" label="Title" value={exp.title || ''} onChange={(e) => updateExperience(i, 'title', e.target.value)} sx={{ flex: 1 }} />
                    </Box>
                    <TextField size="small" label="Period" fullWidth value={exp.period || ''} onChange={(e) => updateExperience(i, 'period', e.target.value)} sx={{ mb: 1 }} />
                    <TextField size="small" label="Description" fullWidth multiline rows={3} value={exp.description || ''} onChange={(e) => updateExperience(i, 'description', e.target.value)} />
                  </Box>
                ))}
                <Button startIcon={<AddIcon />} onClick={addExperience} size="small" variant="outlined">Add Experience</Button>
              </AccordionDetails>
            </Accordion>

            {/* Education */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">🎓 Education</Typography>
                <Chip label={editData.education.length} size="small" sx={{ ml: 1 }} />
              </AccordionSummary>
              <AccordionDetails>
                {editData.education.map((edu, i) => (
                  <Box key={i} sx={{ mb: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 2, border: '1px solid #e5e7eb', position: 'relative' }}>
                    <IconButton size="small" onClick={() => removeEducation(i)} sx={{ position: 'absolute', top: 4, right: 4 }}>
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField size="small" label="School" value={edu.school || edu.institution || ''} onChange={(e) => updateEducation(i, 'school', e.target.value)} sx={{ flex: 1 }} />
                      <TextField size="small" label="Degree" value={edu.degree || ''} onChange={(e) => updateEducation(i, 'degree', e.target.value)} sx={{ flex: 1 }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField size="small" label="Field of Study" value={edu.field || ''} onChange={(e) => updateEducation(i, 'field', e.target.value)} sx={{ flex: 1 }} />
                      <TextField size="small" label="Year" value={edu.year || edu.graduationYear || ''} onChange={(e) => updateEducation(i, 'year', e.target.value)} sx={{ width: 120 }} />
                    </Box>
                  </Box>
                ))}
                <Button startIcon={<AddIcon />} onClick={addEducation} size="small" variant="outlined">Add Education</Button>
              </AccordionDetails>
            </Accordion>

            {/* Projects */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">🚀 Projects</Typography>
                <Chip label={editData.projects.length} size="small" sx={{ ml: 1 }} />
              </AccordionSummary>
              <AccordionDetails>
                {editData.projects.map((proj, i) => (
                  <Box key={i} sx={{ mb: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 2, border: '1px solid #e5e7eb', position: 'relative' }}>
                    <IconButton size="small" onClick={() => removeProject(i)} sx={{ position: 'absolute', top: 4, right: 4 }}>
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                    <TextField size="small" label="Project Name" fullWidth value={proj.title || proj.name || ''} onChange={(e) => updateProject(i, 'title', e.target.value)} sx={{ mb: 1 }} />
                    <TextField size="small" label="Description" fullWidth multiline rows={2} value={proj.description || ''} onChange={(e) => updateProject(i, 'description', e.target.value)} sx={{ mb: 1 }} />
                    <TextField
                      size="small" label="Technologies" fullWidth
                      value={(proj.technologies || []).join(', ')}
                      onChange={(e) => updateProject(i, 'technologies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      helperText="Separate with commas"
                    />
                  </Box>
                ))}
                <Button startIcon={<AddIcon />} onClick={addProject} size="small" variant="outlined">Add Project</Button>
              </AccordionDetails>
            </Accordion>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={previewDirty ? <RefreshIcon /> : <PreviewIcon />}
                onClick={() => { loadPreview(editData); setActiveTab(0); }}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)' }
                }}
              >
                {previewDirty ? 'Update & View Preview' : 'View Preview'}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} disabled={downloading} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleDownload}
          variant="contained"
          disabled={downloading || loadingPreview}
          startIcon={downloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)' }
          }}
        >
          {downloading ? 'Generating...' : `Download ${format === 'pdf' ? 'PDF' : 'Word'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResumeDownloadDialog;
