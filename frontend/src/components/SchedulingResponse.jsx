import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  CalendarToday, 
  AccessTime, 
  VideoCall, 
  Phone, 
  LocationOn,
  Check,
  Close,
  Schedule
} from '@mui/icons-material';
import api from '../services/api';

const Container = styled.div`
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
  border: 1px solid #e0e7ff;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  
  h3 {
    margin: 0;
    color: #1e293b;
    font-size: 16px;
  }
  
  svg {
    color: #6366f1;
  }
`;

const JobInfo = styled.div`
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
  
  .title {
    font-weight: 600;
    color: #1e293b;
  }
  
  .company {
    color: #64748b;
    font-size: 14px;
  }
`;

const SlotsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
`;

const SlotOption = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: ${props => props.$selected ? '#6366f1' : 'white'};
  color: ${props => props.$selected ? 'white' : '#1e293b'};
  border: 2px solid ${props => props.$selected ? '#6366f1' : '#e2e8f0'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    border-color: #6366f1;
    background: ${props => props.$selected ? '#6366f1' : '#f8f9ff'};
  }
  
  .date {
    font-weight: 600;
  }
  
  .time {
    color: ${props => props.$selected ? 'rgba(255,255,255,0.9)' : '#64748b'};
  }
  
  svg {
    color: ${props => props.$selected ? 'white' : '#6366f1'};
  }
`;

const FormatBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: ${props => props.$selected ? 'rgba(255,255,255,0.2)' : '#f1f5f9'};
  border-radius: 20px;
  font-size: 12px;
  margin-left: auto;
  
  svg {
    font-size: 14px;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
`;

const Button = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.primary {
    background: #6366f1;
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background: #4f46e5;
    }
    
    &:disabled {
      background: #c7d2fe;
      cursor: not-allowed;
    }
  }
  
  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    
    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }
  
  &.danger {
    background: white;
    color: #ef4444;
    border: 1px solid #fecaca;
    
    &:hover {
      background: #fef2f2;
    }
  }
`;

const RescheduleForm = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
`;

const DateTimeInput = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  
  input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 14px;
    
    &:focus {
      outline: none;
      border-color: #6366f1;
    }
  }
`;

const MessageInput = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
  margin-top: 12px;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
  }
`;

const SuccessMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 10px;
  color: #065f46;
  
  svg {
    color: #10b981;
  }
`;

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });
};

const getFormatIcon = (format) => {
  switch (format) {
    case 'video': return <VideoCall />;
    case 'phone': return <Phone />;
    case 'in_person': return <LocationOn />;
    default: return <VideoCall />;
  }
};

const SchedulingResponse = ({ interview, onResponse }) => {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [message, setMessage] = useState('');
  const [newSlots, setNewSlots] = useState([{ date: '', time: '' }]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmedTime, setConfirmedTime] = useState(null);

  if (!interview || interview.status !== 'pending') {
    return null;
  }

  const handleAccept = async () => {
    if (selectedSlot === null) return;
    
    setLoading(true);
    try {
      const response = await api.post(`/interviews/${interview.id}/respond`, {
        action: 'accept',
        selectedSlotIndex: selectedSlot,
        message
      });
      
      setConfirmedTime(interview.proposedSlots[selectedSlot]);
      setSubmitted(true);
      
      if (onResponse) {
        onResponse('accepted', response.data);
      }
    } catch (error) {
      console.error('Error accepting interview:', error);
      alert('Failed to confirm interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    const validSlots = newSlots.filter(s => s.date && s.time);
    if (validSlots.length === 0) {
      alert('Please provide at least one alternative time slot.');
      return;
    }
    
    setLoading(true);
    try {
      const proposedSlots = validSlots.map(s => ({
        datetime: new Date(`${s.date}T${s.time}`).toISOString(),
        duration: interview.duration || 30
      }));
      
      await api.post(`/interviews/${interview.id}/respond`, {
        action: 'reschedule',
        proposedSlots,
        message: message || "I'd like to propose alternative times."
      });
      
      setSubmitted(true);
      
      if (onResponse) {
        onResponse('rescheduled');
      }
    } catch (error) {
      console.error('Error rescheduling interview:', error);
      alert('Failed to send reschedule request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this interview?')) return;
    
    setLoading(true);
    try {
      await api.post(`/interviews/${interview.id}/respond`, {
        action: 'decline',
        message: message || 'Thank you for the opportunity, but I must decline.'
      });
      
      setSubmitted(true);
      
      if (onResponse) {
        onResponse('declined');
      }
    } catch (error) {
      console.error('Error declining interview:', error);
      alert('Failed to decline interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addTimeSlot = () => {
    setNewSlots([...newSlots, { date: '', time: '' }]);
  };

  const updateSlot = (index, field, value) => {
    const updated = [...newSlots];
    updated[index][field] = value;
    setNewSlots(updated);
  };

  if (submitted) {
    return (
      <Container>
        <SuccessMessage>
          <Check />
          {confirmedTime ? (
            <div>
              <strong>Interview Confirmed!</strong>
              <div>{formatDate(confirmedTime.datetime)} at {formatTime(confirmedTime.datetime)}</div>
              {interview.meetingLink && (
                <div style={{ marginTop: 8 }}>
                  <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer">
                    Join Meeting
                  </a>
                </div>
              )}
            </div>
          ) : (
            <span>Your response has been sent!</span>
          )}
        </SuccessMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <CalendarToday />
        <h3>Interview Scheduling Request</h3>
      </Header>

      {interview.job && (
        <JobInfo>
          <div className="title">{interview.job.title}</div>
          <div className="company">{interview.job.company}</div>
        </JobInfo>
      )}

      {!showReschedule ? (
        <>
          <p style={{ color: '#64748b', marginBottom: 16 }}>
            Select a time that works for you:
          </p>
          
          <SlotsContainer>
            {interview.proposedSlots.map((slot, index) => (
              <SlotOption
                key={index}
                $selected={selectedSlot === index}
                onClick={() => setSelectedSlot(index)}
              >
                <CalendarToday />
                <div>
                  <div className="date">{formatDate(slot.datetime)}</div>
                  <div className="time">{formatTime(slot.datetime)} ({slot.duration || 30} min)</div>
                </div>
                <FormatBadge $selected={selectedSlot === index}>
                  {getFormatIcon(interview.format)}
                  {interview.format || 'Video'}
                </FormatBadge>
              </SlotOption>
            ))}
          </SlotsContainer>

          <MessageInput
            placeholder="Add a message (optional)..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <ButtonGroup>
            <Button 
              className="primary" 
              onClick={handleAccept}
              disabled={selectedSlot === null || loading}
            >
              <Check /> {loading ? 'Confirming...' : 'Confirm Time'}
            </Button>
            <Button 
              className="secondary"
              onClick={() => setShowReschedule(true)}
            >
              <Schedule /> Propose Different Time
            </Button>
          </ButtonGroup>
          
          <ButtonGroup style={{ marginTop: 8 }}>
            <Button className="danger" onClick={handleDecline} disabled={loading}>
              <Close /> Decline
            </Button>
          </ButtonGroup>
        </>
      ) : (
        <RescheduleForm>
          <p style={{ color: '#64748b', marginBottom: 12 }}>
            Propose alternative times that work for you:
          </p>
          
          {newSlots.map((slot, index) => (
            <DateTimeInput key={index}>
              <input
                type="date"
                value={slot.date}
                onChange={(e) => updateSlot(index, 'date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <input
                type="time"
                value={slot.time}
                onChange={(e) => updateSlot(index, 'time', e.target.value)}
              />
            </DateTimeInput>
          ))}
          
          <Button 
            className="secondary" 
            onClick={addTimeSlot}
            style={{ marginTop: 8, flex: 'none', padding: '8px 16px' }}
          >
            + Add Another Time
          </Button>

          <MessageInput
            placeholder="Add a message explaining your availability..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <ButtonGroup>
            <Button 
              className="primary" 
              onClick={handleReschedule}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Proposal'}
            </Button>
            <Button 
              className="secondary"
              onClick={() => setShowReschedule(false)}
            >
              Back
            </Button>
          </ButtonGroup>
        </RescheduleForm>
      )}
    </Container>
  );
};

export default SchedulingResponse;
