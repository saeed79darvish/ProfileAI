import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { profileAPI } from '../services/api';

const ResumeUploader = ({ onUploadSuccess, onCancel }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or DOCX file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await profileAPI.uploadResume(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = response.data;
      
      // Wait a moment to show 100% progress
      setTimeout(() => {
        onUploadSuccess(data.profileData || data.data);
      }, 500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload resume. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom textAlign="center">
        Upload Your Resume
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
        Our AI will extract your information and create a professional profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          bgcolor: isDragActive ? 'primary.light' : 'grey.50',
          transition: 'all 0.3s',
          '&:hover': {
            borderColor: uploading ? 'grey.300' : 'primary.main',
            bgcolor: uploading ? 'grey.50' : 'primary.light',
          },
        }}
      >
        <input {...getInputProps()} />

        {!uploading && !acceptedFiles.length && (
          <>
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume here'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or
            </Typography>
            <Button variant="contained" component="span">
              Browse Files
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
              Supports PDF, DOC, DOCX (max 5MB)
            </Typography>
          </>
        )}

        {uploading && (
          <Box>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Processing your resume...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Our AI is extracting your information
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {uploadProgress}% complete
            </Typography>
          </Box>
        )}

        {!uploading && acceptedFiles.length > 0 && (
          <Box>
            <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Resume uploaded successfully!
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
              <FileIcon />
              <Typography variant="body2">
                {acceptedFiles[0].name}
              </Typography>
              <Chip label={`${(acceptedFiles[0].size / 1024).toFixed(1)} KB`} size="small" />
            </Box>
          </Box>
        )}
      </Paper>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
          🔒 Your data is secure and private
        </Typography>
      </Box>
    </Box>
  );
};

export default ResumeUploader;
