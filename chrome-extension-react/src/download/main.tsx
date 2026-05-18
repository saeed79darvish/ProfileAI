import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DownloadModal } from '../sidepanel/components/DownloadModal';
import { CONFIG } from '../config';
import '../sidepanel/sidepanel.css';

const DownloadPage: React.FC = () => {
  const [profileData, setProfileData] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('pendingResumeDownload').then(({ pendingResumeDownload }) => {
      if (pendingResumeDownload) {
        setProfileData(pendingResumeDownload);
      }
      setReady(true);
    });
  }, []);

  const buildDefaultFilename = () => {
    if (!profileData) return 'Resume';
    const namePart = [profileData.firstName, profileData.lastName].filter(Boolean).join('_') || 'Resume';
    const jobPart = profileData.jobTitle?.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') || '';
    const companyPart = profileData.company?.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') || '';
    return [namePart, jobPart, companyPart, 'Resume'].filter(Boolean).join('_');
  };

  const handleDownload = async (filename: string, format: 'pdf' | 'docx') => {
    setDownloading(true);
    try {
      const { token } = await chrome.storage.sync.get('token');
      const localData = await chrome.storage.local.get('authToken');
      const authToken = token || localData.authToken;
      if (!authToken) throw new Error('Not authenticated');

      const response = await fetch(`${CONFIG.API_BASE}/resume/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          format,
          template: 'professional',
          tailoredProfileData: profileData,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to generate resume');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const ext = format === 'docx' ? '.docx' : '.pdf';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Close the popup window after download completes
      setTimeout(() => window.close(), 500);
    } catch (err) {
      console.error('[ProfileAI] Download error:', err);
      alert((err as Error).message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => window.close();

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  return (
    <DownloadModal
      open={true}
      onClose={handleClose}
      onDownload={handleDownload}
      defaultFilename={buildDefaultFilename()}
      downloading={downloading}
      profileData={profileData}
    />
  );
};

createRoot(document.getElementById('root')!).render(<DownloadPage />);
