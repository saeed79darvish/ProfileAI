import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

export const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

// ─── Styled Components ─────────────────────────
export const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

export const Card = styled.div`
  background: white;
  border-radius: 24px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15);
  max-width: 640px;
  width: 100%;
  overflow: hidden;
  animation: ${fadeIn} 0.6s ease-out;
`;

export const Header = styled.div`
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  padding: 32px;
  color: white;
  text-align: center;
`;

export const Logo = styled.div`
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
  span { color: #a78bfa; }
`;

export const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
  color: white;
`;

export const Subtitle = styled.p`
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
`;

export const Content = styled.div`
  padding: 32px;
`;

export const JobCard = styled.div`
  background: #f8fafc;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
`;

export const JobTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
`;

export const JobCompany = styled.p`
  font-size: 14px;
  color: #667eea;
  font-weight: 600;
  margin: 0 0 12px;
`;

export const JobMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

export const JobMetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
  svg { font-size: 16px; }
`;

export const PersonalMessage = styled.div`
  background: #faf5ff;
  border-left: 4px solid #a78bfa;
  border-radius: 0 12px 12px 0;
  padding: 16px;
  margin-bottom: 24px;
  font-size: 14px;
  color: #4c1d95;
  line-height: 1.6;
  font-style: italic;
`;

export const ChoiceSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
`;

export const ChoiceCard = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  border: 2px solid ${p => p.$active ? '#667eea' : '#e2e8f0'};
  background: ${p => p.$active ? '#f0f0ff' : 'white'};
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  
  &:hover {
    border-color: #667eea;
    background: #f8f7ff;
  }
`;

export const ChoiceIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${p => p.$color || 'linear-gradient(135deg, #667eea, #764ba2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
`;

export const ChoiceContent = styled.div`
  flex: 1;
`;

export const ChoiceTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
`;

export const ChoiceDesc = styled.div`
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
`;

export const ChoiceTime = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #667eea;
  font-weight: 600;
  margin-top: 8px;
  svg { font-size: 14px; }
`;

// ─── Form Styles ────────────────────────────────
export const FormSection = styled.div`
  animation: ${fadeIn} 0.4s ease-out;
`;

export const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  svg { color: #667eea; font-size: 20px; }
`;

export const DropZone = styled.div`
  border: 2px dashed ${p => p.$hasFile ? '#22c55e' : p.$dragOver ? '#667eea' : '#cbd5e1'};
  border-radius: 16px;
  padding: ${p => p.$hasFile ? '16px' : '40px'};
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: ${p => p.$hasFile ? '#f0fdf4' : p.$dragOver ? '#f0f0ff' : '#f8fafc'};
  margin-bottom: 24px;
  
  &:hover {
    border-color: #667eea;
    background: #f0f0ff;
  }
`;

export const DropZoneIcon = styled.div`
  color: ${p => p.$hasFile ? '#22c55e' : '#94a3b8'};
  margin-bottom: 8px;
  svg { font-size: 48px; }
`;

export const DropZoneText = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0;
  b { color: #667eea; }
`;

export const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const FileName = styled.div`
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
`;

export const FileSize = styled.div`
  font-size: 12px;
  color: #64748b;
`;

export const RemoveButton = styled.button`
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  transition: background 0.2s;
  &:hover { background: #fef2f2; }
`;

export const QuestionGroup = styled.div`
  margin-bottom: 20px;
`;

export const QuestionLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
  
  span { color: #ef4444; margin-left: 2px; }
`;

export const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  
  &:focus { border-color: #667eea; }
  &::placeholder { color: #94a3b8; }
`;

export const TextArea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  color: #1e293b;
  outline: none;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
  
  &:focus { border-color: #667eea; }
  &::placeholder { color: #94a3b8; }
`;

export const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  color: #1e293b;
  outline: none;
  background: white;
  cursor: pointer;
  box-sizing: border-box;
  
  &:focus { border-color: #667eea; }
`;

export const RadioGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const RadioOption = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 2px solid ${p => p.$selected ? '#667eea' : '#e2e8f0'};
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  color: ${p => p.$selected ? '#667eea' : '#64748b'};
  background: ${p => p.$selected ? '#f0f0ff' : 'white'};
  transition: all 0.2s;
  
  input { display: none; }
  &:hover { border-color: #667eea; }
`;

export const ConsentSection = styled.div`
  background: #f8fafc;
  border-radius: 16px;
  padding: 20px;
  margin-top: 24px;
  margin-bottom: 24px;
`;

export const ConsentLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 12px;
  
  input[type="checkbox"] {
    margin-top: 3px;
    width: 18px;
    height: 18px;
    accent-color: #667eea;
    flex-shrink: 0;
  }
  
  a {
    color: #667eea;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

export const SubmitButton = styled.button`
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 14px;
  background: ${p => p.disabled ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s;
  
  &:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  }
`;

export const BackButton = styled.button`
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  padding: 8px 0;
  margin-bottom: 16px;
  
  &:hover { color: #667eea; }
`;

// ─── Success State ────────────────────────────
export const SuccessContainer = styled.div`
  text-align: center;
  padding: 32px;
  animation: ${fadeIn} 0.6s ease-out;
`;

export const SuccessIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  svg { font-size: 40px; }
  animation: ${pulse} 0.6s ease-out;
`;

export const TrackingCode = styled.div`
  background: #f8fafc;
  border: 2px dashed #667eea;
  border-radius: 14px;
  padding: 20px;
  margin: 20px 0;
`;

export const TrackingLabel = styled.div`
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
`;

export const TrackingValue = styled.div`
  font-size: 28px;
  font-weight: 800;
  color: #667eea;
  letter-spacing: 4px;
  font-family: monospace;
`;

export const NextSteps = styled.div`
  text-align: left;
  margin-top: 24px;
`;

export const StepItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  font-size: 14px;
  color: #475569;
  
  svg { color: #22c55e; font-size: 18px; margin-top: 2px; flex-shrink: 0; }
`;

// ─── Loading / Error States ────────────────────
export const LoadingContainer = styled.div`
  text-align: center;
  padding: 60px 32px;
`;

export const LoadingBar = styled.div`
  width: 200px;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
  margin: 20px auto;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    width: 50%;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #667eea, #764ba2);
    animation: ${shimmer} 1.5s infinite;
  }
`;

export const ErrorContainer = styled.div`
  text-align: center;
  padding: 60px 32px;
  color: #64748b;
`;

export const ErrorTitle = styled.h2`
  font-size: 20px;
  color: #1e293b;
  margin-bottom: 8px;
`;
