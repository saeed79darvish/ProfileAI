import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, IconButton, alpha,
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon, Image as ImageIcon } from '@mui/icons-material';
import { challengesAPI } from '../../services/api';

const MOOD_OPTIONS = [
  { value: 'struggling', emoji: '😓', label: 'Struggling' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'great', emoji: '😊', label: 'Great' },
  { value: 'crushing', emoji: '🔥', label: 'Crushing It' }
];

export default function CheckInModal({ open, onClose, challengeId, onSuccess }) {
  const [mood, setMood] = useState('good');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      
      await challengesAPI.checkIn(challengeId, { mood, content, image });
      
      // Reset form
      setMood('good');
      setContent('');
      setImage(null);
      setImagePreview(null);
      
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err.response?.data?.message || 'Failed to submit check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Daily Check-In</Typography>
          <Typography variant="body2" color="text.secondary">
            How's your progress today?
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={submitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Box sx={{ mb: 2, p: 2, bgcolor: alpha('#EF4444', 0.1), borderRadius: 2 }}>
            <Typography variant="body2" color="error">{error}</Typography>
          </Box>
        )}
        
        <Typography variant="subtitle2" gutterBottom>
          How are you feeling?
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', my: 3 }}>
          {MOOD_OPTIONS.map(option => (
            <Box
              key={option.value}
              onClick={() => !submitting && setMood(option.value)}
              sx={{
                cursor: submitting ? 'default' : 'pointer',
                p: 1.5,
                borderRadius: 2,
                border: '2px solid',
                borderColor: mood === option.value ? '#7c5ecf' : 'grey.200',
                bgcolor: mood === option.value ? alpha('#7c5ecf', 0.1) : 'transparent',
                transition: 'all 0.2s',
                textAlign: 'center',
                opacity: submitting ? 0.5 : 1,
                '&:hover': submitting ? {} : { borderColor: '#7c5ecf', transform: 'scale(1.05)' }
              }}
            >
              <Typography variant="h4">{option.emoji}</Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {option.label}
              </Typography>
            </Box>
          ))}
        </Box>
        
        <TextField
          fullWidth
          multiline
          rows={4}
          label="What did you accomplish today?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your progress, wins, learnings, or challenges you faced..."
          disabled={submitting}
          sx={{ mb: 2 }}
        />
        
        {imagePreview ? (
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Box
              component="img"
              src={imagePreview}
              alt="Upload preview"
              sx={{ 
                width: '100%', 
                maxHeight: 200, 
                objectFit: 'cover', 
                borderRadius: 2 
              }}
            />
            <IconButton
              onClick={removeImage}
              disabled={submitting}
              sx={{ 
                position: 'absolute', 
                top: 8, 
                right: 8, 
                bgcolor: '#555',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Button
            component="label"
            variant="outlined"
            startIcon={<ImageIcon />}
            disabled={submitting}
            sx={{ 
              borderStyle: 'dashed', 
              borderColor: 'grey.300',
              color: 'text.secondary',
              '&:hover': { borderColor: '#7c5ecf', color: '#7c5ecf' }
            }}
          >
            Add a photo (optional)
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleImageChange}
            />
          </Button>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting && <CircularProgress size={20} color="inherit" />}
          sx={{ 
            background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
            minWidth: 120
          }}
        >
          {submitting ? 'Submitting...' : 'Check In'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
