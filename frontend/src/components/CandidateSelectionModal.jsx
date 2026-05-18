import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  Avatar,
  Chip,
  Typography,
  Box,
  TextField,
  InputAdornment,
  FormControlLabel,
  LinearProgress,
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WorkIcon from '@mui/icons-material/Work';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
  }
`;

const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
`;

const StatBox = styled.div`
  display: flex;
  flex-direction: column;
  
  .label {
    font-size: 12px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .value {
    font-size: 24px;
    font-weight: 600;
    color: #1976d2;
  }
`;

const ControlsRow = styled.div`
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 20px;
`;

const CandidateList = styled.div`
  max-height: 450px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
    
    &:hover {
      background: #555;
    }
  }
`;

const CandidateCard = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 16px;
  margin-bottom: 12px;
  border: 2px solid ${props => props.$selected ? '#1976d2' : '#e0e0e0'};
  border-radius: 12px;
  background: ${props => props.$selected ? '#f0f7ff' : '#fff'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #1976d2;
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.1);
  }
`;

const CheckboxColumn = styled.div`
  flex-shrink: 0;
  padding-top: 4px;
`;

const RankColumn = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
  margin-right: 4px;
  color: ${props => props.$rank <= 3 ? '#fff' : '#666'};
  background: ${props => {
    if (props.$rank === 1) return 'linear-gradient(135deg, #FFD700, #FFA500)';
    if (props.$rank === 2) return 'linear-gradient(135deg, #C0C0C0, #A0A0A0)';
    if (props.$rank === 3) return 'linear-gradient(135deg, #CD7F32, #A0522D)';
    return '#f5f5f5';
  }};
  box-shadow: ${props => props.$rank <= 3 ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'};
`;

const AvatarColumn = styled.div`
  flex-shrink: 0;
  margin: 0 16px;
`;

const InfoColumn = styled.div`
  flex: 1;
  min-width: 0;
`;

const CandidateName = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
`;

const CandidateTitle = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const MetaRow = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
  
  svg {
    font-size: 16px;
  }
`;

const SkillsRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const ScoreColumn = styled.div`
  flex-shrink: 0;
  text-align: center;
  padding-left: 16px;
  border-left: 1px solid #e0e0e0;
`;

const ScoreBadge = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${props => {
    if (props.$score >= 80) return 'linear-gradient(135deg, #4caf50, #81c784)';
    if (props.$score >= 60) return 'linear-gradient(135deg, #2196f3, #64b5f6)';
    return 'linear-gradient(135deg, #ff9800, #ffb74d)';
  }};
  color: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  
  .score {
    font-size: 28px;
    font-weight: 700;
  }
  
  .label {
    font-size: 10px;
    text-transform: uppercase;
    margin-top: -4px;
  }
`;

const BreakdownRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
`;

const BreakdownItem = styled.div`
  display: flex;
  flex-direction: column;
  
  .label {
    color: #999;
    text-transform: uppercase;
    font-size: 10px;
  }
  
  .value {
    color: #666;
    font-weight: 600;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #999;
  
  svg {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.3;
  }
`;

const CandidateSelectionModal = ({ 
  open, 
  onClose, 
  candidates = [], 
  onStartScreening,
  jobTitle 
}) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  // Filter candidates based on search
  const filteredCandidates = useMemo(() => {
    if (!searchTerm) return candidates;
    
    const term = searchTerm.toLowerCase();
    return candidates.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.title?.toLowerCase().includes(term) ||
      c.skills?.some(s => s.toLowerCase().includes(term)) ||
      c.location?.toLowerCase().includes(term)
    );
  }, [candidates, searchTerm]);

  // Toggle individual candidate selection
  const handleToggle = (candidateId) => {
    setSelectedIds(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      } else {
        return [...prev, candidateId];
      }
    });
  };

  // Toggle all visible candidates
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(filteredCandidates.map(c => c.candidateId));
      setSelectAll(true);
    }
  };

  // Select top N candidates
  const handleSelectTop = (count) => {
    const topIds = filteredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(c => c.candidateId);
    setSelectedIds(topIds);
  };

  // Handle start screening
  const handleStart = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one candidate');
      return;
    }
    onStartScreening(selectedIds);
  };

  // Calculate stats
  const totalCandidates = candidates.length;
  const selectedCount = selectedIds.length;
  const avgScore = candidates.length > 0 
    ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length)
    : 0;

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="lg">
      <DialogTitle>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          Select Candidates for AI Screening
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {jobTitle}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <HeaderSection>
          <StatsRow>
            <StatBox>
              <span className="label">Found</span>
              <span className="value">{totalCandidates}</span>
            </StatBox>
            <StatBox>
              <span className="label">Selected</span>
              <span className="value">{selectedCount}</span>
            </StatBox>
            <StatBox>
              <span className="label">Avg Score</span>
              <span className="value">{avgScore}</span>
            </StatBox>
          </StatsRow>
        </HeaderSection>

        <ControlsRow>
          <TextField
            placeholder="Search by name, title, skills..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControlLabel
            control={
              <Checkbox 
                checked={selectAll} 
                onChange={handleSelectAll}
              />
            }
            label="Select All"
          />
          
          <Button 
            size="small" 
            variant="outlined"
            onClick={() => handleSelectTop(5)}
          >
            Top 5
          </Button>
          <Button 
            size="small" 
            variant="outlined"
            onClick={() => handleSelectTop(10)}
          >
            Top 10
          </Button>
        </ControlsRow>

        <CandidateList>
          {filteredCandidates.length === 0 ? (
            <EmptyState>
              <PersonIcon />
              <Typography variant="h6">
                {searchTerm ? 'No candidates match your search' : 'No candidates found'}
              </Typography>
            </EmptyState>
          ) : (
            filteredCandidates.map((candidate, index) => {
              const isSelected = selectedIds.includes(candidate.candidateId);
              const rank = index + 1;
              
              return (
                <CandidateCard
                  key={candidate.candidateId}
                  $selected={isSelected}
                  onClick={() => handleToggle(candidate.candidateId)}
                >
                  <CheckboxColumn>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggle(candidate.candidateId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </CheckboxColumn>

                  <RankColumn $rank={rank}>
                    {rank}
                  </RankColumn>
                  
                  <AvatarColumn>
                    <Avatar 
                      src={candidate.profilePicture} 
                      sx={{ width: 56, height: 56 }}
                    >
                      {candidate.name?.charAt(0)}
                    </Avatar>
                  </AvatarColumn>
                  
                  <InfoColumn>
                    <CandidateName>{candidate.name}</CandidateName>
                    <CandidateTitle>{candidate.title}</CandidateTitle>
                    
                    <MetaRow>
                      {candidate.location && (
                        <MetaItem>
                          <LocationOnIcon />
                          {candidate.location}
                        </MetaItem>
                      )}
                      {candidate.experience > 0 && (
                        <MetaItem>
                          <WorkIcon />
                          {candidate.experience} years exp
                        </MetaItem>
                      )}
                    </MetaRow>
                    
                    {candidate.skills && candidate.skills.length > 0 && (
                      <SkillsRow>
                        {candidate.skills.slice(0, 5).map((skill, idx) => (
                          <Chip 
                            key={idx} 
                            label={skill} 
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {candidate.skills.length > 5 && (
                          <Chip 
                            label={`+${candidate.skills.length - 5} more`} 
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </SkillsRow>
                    )}
                  </InfoColumn>
                  
                  <ScoreColumn>
                    <Tooltip title="Match Score">
                      <ScoreBadge $score={candidate.score}>
                        <div className="score">{candidate.score}</div>
                        <div className="label">Match</div>
                      </ScoreBadge>
                    </Tooltip>
                    
                    {candidate.breakdown && (
                      <BreakdownRow>
                        <BreakdownItem>
                          <span className="label">Skills</span>
                          <span className="value">{candidate.breakdown.skills || 0}</span>
                        </BreakdownItem>
                        <BreakdownItem>
                          <span className="label">Exp</span>
                          <span className="value">{candidate.breakdown.experience || 0}</span>
                        </BreakdownItem>
                      </BreakdownRow>
                    )}
                  </ScoreColumn>
                </CandidateCard>
              );
            })
          )}
        </CandidateList>
      </DialogContent>
      
      <DialogActions sx={{ padding: '16px 24px', borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleStart}
          variant="contained"
          disabled={selectedIds.length === 0}
          startIcon={<StarIcon />}
        >
          Start AI Screening ({selectedCount} selected)
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default CandidateSelectionModal;
