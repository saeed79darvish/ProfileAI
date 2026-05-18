import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CONFIG } from '../../config';

interface ProfileData {
  summary?: string;
  skills?: string[];
  experience?: Array<{ company?: string; title?: string; period?: string; description?: string }>;
  education?: Array<{ school?: string; institution?: string; degree?: string; field?: string; year?: string; graduationYear?: string }>;
  projects?: Array<{ title?: string; name?: string; description?: string; technologies?: string[] }>;
  title?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  onDownload: (filename: string, format: 'pdf' | 'docx') => void;
  defaultFilename: string;
  downloading: boolean;
  profileData?: ProfileData | null;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  open,
  onClose,
  onDownload,
  defaultFilename,
  downloading,
  profileData,
}) => {
  const [filename, setFilename] = useState(defaultFilename);
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [editData, setEditData] = useState<ProfileData | null>(null);
  const [previewDirty, setPreviewDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename);
      setFormat('pdf');
      setActiveTab('preview');
      setPreviewDirty(false);
      if (profileData) {
        setEditData({ ...profileData });
      }
      loadPreview(profileData || undefined);
    }
  }, [open, defaultFilename, profileData]);

  const loadPreview = async (data?: ProfileData) => {
    setLoadingPreview(true);
    try {
      const { token } = await chrome.storage.sync.get('token');
      const authToken = token || (await chrome.storage.local.get('authToken')).authToken;
      if (!authToken) return;

      const res = await fetch(`${CONFIG.API_BASE}/resume/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ templateId: 'professional', tailoredProfileData: data || null }),
      });

      if (res.ok) {
        const json = await res.json();
        setPreviewUrl(json.preview);
        setPreviewDirty(false);
      }
    } catch (err) {
      console.error('[ProfileAI] Preview error:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  if (!open) return null;

  const handleDownload = () => {
    const cleanName = filename.trim() || defaultFilename;
    onDownload(cleanName, format);
  };

  const updateField = (field: string, value: any) => {
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
    setPreviewDirty(true);
  };

  const updateArrayItem = (field: string, index: number, key: string, value: any) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const arr = [...((prev as any)[field] || [])];
      arr[index] = { ...arr[index], [key]: value };
      return { ...prev, [field]: arr };
    });
    setPreviewDirty(true);
  };

  const removeArrayItem = (field: string, index: number) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const arr = ((prev as any)[field] || []).filter((_: any, i: number) => i !== index);
      return { ...prev, [field]: arr };
    });
    setPreviewDirty(true);
  };

  const addExperience = () => {
    setEditData((prev) => prev ? { ...prev, experience: [...(prev.experience || []), { company: '', title: '', period: '', description: '' }] } : prev);
    setPreviewDirty(true);
  };

  const addEducation = () => {
    setEditData((prev) => prev ? { ...prev, education: [...(prev.education || []), { school: '', degree: '', field: '', year: '' }] } : prev);
    setPreviewDirty(true);
  };

  const addProject = () => {
    setEditData((prev) => prev ? { ...prev, projects: [...(prev.projects || []), { title: '', description: '', technologies: [] }] } : prev);
    setPreviewDirty(true);
  };

  return createPortal(
    <div className="dl-modal-overlay" onClick={onClose}>
      <div className="dl-modal dl-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="dl-modal-header">
          <h3 className="dl-modal-title">📄 Resume</h3>
          <div className="dl-tabs">
            <button className={`dl-tab ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>Preview</button>
            {editData && <button className={`dl-tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>Edit</button>}
          </div>
          <button className="dl-modal-close" onClick={onClose} disabled={downloading}>✕</button>
        </div>

        {activeTab === 'preview' && (
          <>
            {/* Filename */}
            <div className="dl-field">
              <label className="dl-label">File Name</label>
              <input
                className="dl-input"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Resume filename"
                disabled={downloading}
              />
              <span style={{ fontSize: 12, color: '#888', marginTop: 2 }}>.{format === 'pdf' ? 'pdf' : 'docx'}</span>
            </div>

            {/* Format Toggle */}
            <div className="dl-field">
              <label className="dl-label">Format</label>
              <div className="dl-format-toggle">
                <button
                  className={`dl-format-btn ${format === 'pdf' ? 'active' : ''}`}
                  onClick={() => setFormat('pdf')}
                  disabled={downloading}
                >
                  📄 PDF
                </button>
                <button
                  className={`dl-format-btn ${format === 'docx' ? 'active' : ''}`}
                  onClick={() => setFormat('docx')}
                  disabled={downloading}
                >
                  📝 Word
                </button>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="dl-preview-frame">
              {loadingPreview ? (
                <div className="dl-preview-loading">
                  <svg className="icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" />
                  </svg>
                  <span>Generating preview...</span>
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} title="Resume Preview" className="dl-preview-iframe" />
              ) : (
                <div className="dl-preview-loading"><span>Preview not available</span></div>
              )}
            </div>

            {previewDirty && (
              <button className="dl-btn-update" onClick={() => loadPreview(editData || undefined)}>
                ↻ Update Preview
              </button>
            )}

            {/* Actions */}
            <div className="dl-actions">
              <button className="dl-btn cancel" onClick={onClose} disabled={downloading}>Cancel</button>
              <button className="dl-btn download" onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <>
                    <svg className="icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" /></svg>
                    Generating...
                  </>
                ) : (
                  <>Download {format === 'pdf' ? 'PDF' : 'Word'}</>
                )}
              </button>
            </div>
          </>
        )}

        {activeTab === 'edit' && editData && (
          <div className="dl-edit-scroll">
            {/* Summary */}
            <div className="dl-edit-section">
              <h4 className="dl-edit-title">📝 Summary</h4>
              <textarea
                className="dl-textarea"
                rows={4}
                value={editData.summary || ''}
                onChange={(e) => updateField('summary', e.target.value)}
              />
            </div>

            {/* Skills */}
            <div className="dl-edit-section">
              <h4 className="dl-edit-title">🛠 Skills ({(editData.skills || []).length})</h4>
              <textarea
                className="dl-textarea"
                rows={2}
                value={(editData.skills || []).map((s: any) => typeof s === 'string' ? s : s.name || '').join(', ')}
                onChange={(e) => updateField('skills', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                placeholder="Separate with commas"
              />
            </div>

            {/* Experience */}
            <div className="dl-edit-section">
              <h4 className="dl-edit-title">💼 Experience ({(editData.experience || []).length})</h4>
              {(editData.experience || []).map((exp, i) => (
                <div key={i} className="dl-edit-card">
                  <button className="dl-edit-remove" onClick={() => removeArrayItem('experience', i)}>✕</button>
                  <input className="dl-input" placeholder="Company" value={exp.company || ''} onChange={(e) => updateArrayItem('experience', i, 'company', e.target.value)} />
                  <input className="dl-input" placeholder="Title" value={exp.title || ''} onChange={(e) => updateArrayItem('experience', i, 'title', e.target.value)} />
                  <input className="dl-input" placeholder="Period" value={exp.period || ''} onChange={(e) => updateArrayItem('experience', i, 'period', e.target.value)} />
                  <textarea className="dl-textarea" rows={2} placeholder="Description" value={exp.description || ''} onChange={(e) => updateArrayItem('experience', i, 'description', e.target.value)} />
                </div>
              ))}
              <button className="dl-edit-add" onClick={addExperience}>+ Add Experience</button>
            </div>

            {/* Education */}
            <div className="dl-edit-section">
              <h4 className="dl-edit-title">🎓 Education ({(editData.education || []).length})</h4>
              {(editData.education || []).map((edu, i) => (
                <div key={i} className="dl-edit-card">
                  <button className="dl-edit-remove" onClick={() => removeArrayItem('education', i)}>✕</button>
                  <input className="dl-input" placeholder="School" value={edu.school || edu.institution || ''} onChange={(e) => updateArrayItem('education', i, 'school', e.target.value)} />
                  <input className="dl-input" placeholder="Degree" value={edu.degree || ''} onChange={(e) => updateArrayItem('education', i, 'degree', e.target.value)} />
                  <input className="dl-input" placeholder="Field" value={edu.field || ''} onChange={(e) => updateArrayItem('education', i, 'field', e.target.value)} />
                  <input className="dl-input" placeholder="Year" value={edu.year || edu.graduationYear || ''} onChange={(e) => updateArrayItem('education', i, 'year', e.target.value)} />
                </div>
              ))}
              <button className="dl-edit-add" onClick={addEducation}>+ Add Education</button>
            </div>

            {/* Projects */}
            <div className="dl-edit-section">
              <h4 className="dl-edit-title">🚀 Projects ({(editData.projects || []).length})</h4>
              {(editData.projects || []).map((proj, i) => (
                <div key={i} className="dl-edit-card">
                  <button className="dl-edit-remove" onClick={() => removeArrayItem('projects', i)}>✕</button>
                  <input className="dl-input" placeholder="Name" value={proj.title || proj.name || ''} onChange={(e) => updateArrayItem('projects', i, 'title', e.target.value)} />
                  <textarea className="dl-textarea" rows={2} placeholder="Description" value={proj.description || ''} onChange={(e) => updateArrayItem('projects', i, 'description', e.target.value)} />
                  <input className="dl-input" placeholder="Technologies (comma-separated)" value={(proj.technologies || []).join(', ')} onChange={(e) => updateArrayItem('projects', i, 'technologies', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} />
                </div>
              ))}
              <button className="dl-edit-add" onClick={addProject}>+ Add Project</button>
            </div>

            <button
              className="dl-btn download"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => { loadPreview(editData); setActiveTab('preview'); }}
            >
              {previewDirty ? '↻ Update & View Preview' : '👁 View Preview'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
