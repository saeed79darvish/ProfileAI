import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Modal,
  Box,
  IconButton,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PollIcon from '@mui/icons-material/Poll';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { pollsAPI, postAPI } from '../../services/api';

const ModalContent = styled(Box)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #ffffff;
  border: 1px solid rgba(124, 94, 207, 0.2);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  outline: none;

  .MuiTextField-root, .MuiFormControl-root {
    .MuiOutlinedInput-root {
      background: rgba(0, 0, 0, 0.03);
      color: #1a1a2e;
      border-radius: 10px;

      .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.12);
      }
      &:hover .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.2);
      }
      &.Mui-focused .MuiOutlinedInput-notchedOutline {
        border-color: #7c5ecf;
      }
    }
    .MuiInputLabel-root {
      color: #555;
      &.Mui-focused {
        color: #7c5ecf;
      }
    }
    .MuiInputBase-input {
      color: #1a1a2e;

      &::placeholder {
        color: #888;
        opacity: 1;
      }
    }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  background: #ffffff;
  z-index: 10;
  
  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a2e;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const Content = styled.div`
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionLabel = styled.label`
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 8px;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const OptionNumber = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => props.$color};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
`;

const AddOptionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.03);
  border: 2px dashed rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  color: #555;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
  
  &:hover {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.25);
    color: rgba(0, 0, 0, 0.7);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SettingsRow = styled.div`
  display: flex;
  gap: 16px;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CategoryChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const CategoryChip = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: ${props => props.$selected ? props.$color + '20' : 'rgba(0,0,0,0.03)'};
  border: 2px solid ${props => props.$selected ? props.$color : 'transparent'};
  border-radius: 20px;
  color: ${props => props.$selected ? props.$color : '#555'};
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.$color}15;
    border-color: ${props => props.$color};
    color: ${props => props.$color};
  }
`;

const ExpiryChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ExpiryChip = styled.button`
  padding: 8px 16px;
  background: ${props => props.$selected ? 'linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%)' : 'rgba(0,0,0,0.03)'};
  border: none;
  border-radius: 20px;
  color: ${props => props.$selected ? 'white' : '#555'};
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.$selected 
      ? 'linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)' 
      : 'rgba(0,0,0,0.05)'};
  }
`;

const AnonymousNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(124, 94, 207, 0.1);
  border-radius: 8px;
  font-size: 0.8rem;
  color: #7c5ecf;
  margin-top: 8px;
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  position: sticky;
  bottom: 0;
  background: #ffffff;
`;

const SubmitButton = styled(Button)`
  && {
    background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
    color: white;
    padding: 10px 24px;
    border-radius: 8px;
    text-transform: none;
    font-weight: 600;
    
    &:hover {
      background: linear-gradient(135deg, #6d28d9 0%, #9333ea 100%);
    }
    
    &:disabled {
      background: rgba(0, 0, 0, 0.05);
      color: #888;
    }
  }
`;

const CATEGORIES = [
  { value: 'career', emoji: '💼', label: 'Career', color: '#7c5ecf' },
  { value: 'tech', emoji: '🛠', label: 'Tech', color: '#9333ea' },
  { value: 'industry', emoji: '📈', label: 'Industry', color: '#818cf8' },
  { value: 'learning', emoji: '🎓', label: 'Learning', color: '#8B5CF6' },
  { value: 'general', emoji: '💭', label: 'General', color: '#888' }
];

const EXPIRY_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '3d', label: '3 days' },
  { value: '7d', label: '7 days' }
];

const OPTION_COLORS = ['#7c5ecf', '#9333ea', '#818cf8', '#c084fc'];

const CreatePollModal = ({ open, onClose, onPollCreated }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [category, setCategory] = useState('general');
  const [expiryPreset, setExpiryPreset] = useState('24h');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    // Validation
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    
    const filledOptions = options.filter(opt => opt.trim());
    if (filledOptions.length < 2) {
      setError('Please enter at least 2 options');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await pollsAPI.create({
        question: question.trim(),
        options: filledOptions,
        category,
        expiryPreset,
        isAnonymous
      });

      if (onPollCreated) {
        onPollCreated(response.data);
      }

      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setCategory('general');
      setExpiryPreset('24h');
      setIsAnonymous(false);
      
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const isValid = question.trim() && options.filter(opt => opt.trim()).length >= 2;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalContent>
        <Header>
          <h2>
            <PollIcon color="primary" />
            Create a Poll
          </h2>
          <IconButton onClick={onClose} size="small" sx={{ color: '#555' }}>
            <CloseIcon />
          </IconButton>
        </Header>

        <Content>
          {/* Question */}
          <Section>
            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="What do you want to ask? (e.g., 'Should I take this job offer?')"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              variant="outlined"
              inputProps={{ maxLength: 500 }}
            />
          </Section>

          {/* Options */}
          <Section>
            <SectionLabel>Options (2-4)</SectionLabel>
            <OptionsContainer>
              {options.map((option, index) => (
                <OptionRow key={index}>
                  <OptionNumber $color={OPTION_COLORS[index]}>
                    {index + 1}
                  </OptionNumber>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    inputProps={{ maxLength: 100 }}
                  />
                  {options.length > 2 && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleRemoveOption(index)}
                      sx={{ color: '#ef4444' }}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  )}
                </OptionRow>
              ))}
              {options.length < 4 && (
                <AddOptionButton onClick={handleAddOption}>
                  <AddIcon fontSize="small" />
                  Add another option
                </AddOptionButton>
              )}
            </OptionsContainer>
          </Section>

          {/* Category */}
          <Section>
            <SectionLabel>Category</SectionLabel>
            <CategoryChips>
              {CATEGORIES.map(cat => (
                <CategoryChip
                  key={cat.value}
                  $selected={category === cat.value}
                  $color={cat.color}
                  onClick={() => setCategory(cat.value)}
                  type="button"
                >
                  {cat.emoji} {cat.label}
                </CategoryChip>
              ))}
            </CategoryChips>
          </Section>

          {/* Expiry */}
          <Section>
            <SectionLabel>Poll Duration</SectionLabel>
            <ExpiryChips>
              {EXPIRY_OPTIONS.map(exp => (
                <ExpiryChip
                  key={exp.value}
                  $selected={expiryPreset === exp.value}
                  onClick={() => setExpiryPreset(exp.value)}
                  type="button"
                >
                  {exp.label}
                </ExpiryChip>
              ))}
            </ExpiryChips>
          </Section>

          {/* Anonymous Toggle */}
          <Section>
            <FormControlLabel
              control={
                <Switch
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(0,0,0,0.7)' }}>
                  <VisibilityOffIcon fontSize="small" />
                  Anonymous Voting
                </span>
              }
            />
            {isAnonymous && (
              <AnonymousNote>
                <VisibilityOffIcon fontSize="small" />
                Voters' identities will be hidden. Great for controversial topics!
              </AnonymousNote>
            )}
          </Section>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: 8 }}>
              {error}
            </div>
          )}
        </Content>

        <Footer>
          <Button onClick={onClose} disabled={loading} sx={{ color: '#555' }}>
            Cancel
          </Button>
          <SubmitButton
            onClick={handleSubmit}
            disabled={!isValid || loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PollIcon />}
          >
            {loading ? 'Creating...' : 'Create Poll'}
          </SubmitButton>
        </Footer>
      </ModalContent>
    </Modal>
  );
};

export default CreatePollModal;
