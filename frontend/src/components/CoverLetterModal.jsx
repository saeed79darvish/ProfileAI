import React, { useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Dialog,
  CircularProgress
} from '@mui/material';
import {
  Description as DescIcon,
  Close as CloseIcon,
  ContentCopy,
  Download,
  Refresh,
  CheckCircle
} from '@mui/icons-material';

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', desc: 'Formal and polished' },
  { value: 'conversational', label: 'Conversational', desc: 'Friendly and natural' },
  { value: 'enthusiastic', label: 'Enthusiastic', desc: 'Energetic and passionate' },
];

// === Styled Components ===
const ModalContainer = styled.div`
  padding: 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 16px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const IconBox = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg { font-size: 24px; color: #667eea; }
`;

const HeaderText = styled.div`
  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
  }
  
  .company {
    font-size: 13px;
    color: #667eea;
    font-weight: 500;
    margin-top: 2px;
  }
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: #6b7280;
  transition: all 0.2s;
  
  &:hover { background: #f3f4f6; color: #1a1a2e; }
  svg { font-size: 22px; }
`;

const Subtitle = styled.p`
  margin: 0 28px 20px;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
`;

const Body = styled.div`
  padding: 0 28px 20px;
`;

const Section = styled.div`
  margin-bottom: 22px;
  
  &:last-child { margin-bottom: 0; }
`;

const SectionLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 10px;
`;

const OptionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
`;

const OptionBtn = styled.button`
  padding: 14px 10px;
  border-radius: 12px;
  border: 2px solid ${p => p.$active ? '#667eea' : '#e5e7eb'};
  background: ${p => p.$active ? '#667eea08' : 'white'};
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  
  &:hover { border-color: #667eea; }
  
  .name {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: ${p => p.$active ? '#667eea' : '#374151'};
    margin-bottom: 4px;
  }
  
  .desc {
    display: block;
    font-size: 11px;
    color: #9ca3af;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ResultArea = styled.div`
  animation: ${fadeIn} 0.3s ease;
`;

const ResultLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const ResultTextarea = styled.textarea`
  width: 100%;
  min-height: 200px;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
  font-family: inherit;
  color: #374151;
  resize: vertical;
  transition: border-color 0.2s;
  box-sizing: border-box;
  
  &:focus {
    border-color: #667eea;
    outline: none;
    box-shadow: 0 0 0 3px #667eea15;
  }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #667eea;
    color: #667eea;
  }
  
  svg { font-size: 18px; }
  
  &.copied {
    border-color: #10b981;
    color: #10b981;
    background: #10b98108;
  }
`;

const GeneratingBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  gap: 16px;
  
  p {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 28px 24px;
  border-top: 1px solid #f3f4f6;
`;

const CancelBtn = styled.button`
  padding: 10px 24px;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover { background: #f9fafb; }
`;

const GenerateBtn = styled.button`
  padding: 10px 28px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #1a1a2e, #2d2b55);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 26, 46, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SliderContainer = styled.div`
  padding: 0 4px;
`;

const SliderTrack = styled.div`
  position: relative;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  cursor: pointer;
`;

const SliderFill = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #667eea;
  border-radius: 3px;
  transition: width 0.1s;
`;

const SliderThumb = styled.div`
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: white;
  border: 2px solid #667eea;
  border-radius: 50%;
  cursor: grab;
  transition: box-shadow 0.2s;
  
  &:hover {
    box-shadow: 0 0 0 4px #667eea20;
  }
`;

const SliderLabels = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: #9ca3af;
`;

const SliderValue = styled.div`
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 12px;
`;

// === Component ===
export default function CoverLetterModal({ open, onClose, jobTitle, company, onGenerate }) {
  const [tone, setTone] = useState('professional');
  const [lines, setLines] = useState(8);
  const [coverLetter, setCoverLetter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setCoverLetter('');
    setGenerated(false);
    try {
      const result = await onGenerate({ tone, lines });
      setCoverLetter(result || '');
      setGenerated(true);
    } catch (err) {
      console.error('Cover letter generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = () => {
    const blob = new Blob([coverLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover_Letter_${(company || 'Job').replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = () => {
    setGenerated(false);
    setCoverLetter('');
  };

  const handleClose = () => {
    setCoverLetter('');
    setGenerated(false);
    setGenerating(false);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ style: { borderRadius: 20, overflow: 'hidden' } }}
    >
      <ModalContainer>
        <Header>
          <HeaderLeft>
            <IconBox><DescIcon /></IconBox>
            <HeaderText>
              <h3>Cover Letter</h3>
              {company && <div className="company">{company}</div>}
            </HeaderText>
          </HeaderLeft>
          <CloseBtn onClick={handleClose}><CloseIcon /></CloseBtn>
        </Header>

        <Subtitle>
          Generate a tailored cover letter for this position.
        </Subtitle>

        <Body>
          {!generating && !generated && (
            <>
              <Section>
                <SectionLabel>Tone</SectionLabel>
                <OptionGrid>
                  {TONE_OPTIONS.map(opt => (
                    <OptionBtn key={opt.value} $active={tone === opt.value} onClick={() => setTone(opt.value)}>
                      <span className="name">{opt.label}</span>
                      <span className="desc">{opt.desc}</span>
                    </OptionBtn>
                  ))}
                </OptionGrid>
              </Section>

              <Section>
                <SectionLabel>Length</SectionLabel>
                <SliderValue>{lines} lines</SliderValue>
                <SliderContainer>
                  <SliderTrack
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      setLines(Math.round(Math.min(20, Math.max(4, 4 + pct * 16))));
                    }}
                  >
                    <SliderFill style={{ width: `${((lines - 4) / 16) * 100}%` }} />
                    <SliderThumb
                      style={{ left: `${((lines - 4) / 16) * 100}%` }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const track = e.currentTarget.parentElement;
                        const onMove = (ev) => {
                          const rect = track.getBoundingClientRect();
                          const pct = (ev.clientX - rect.left) / rect.width;
                          setLines(Math.round(Math.min(20, Math.max(4, 4 + pct * 16))));
                        };
                        const onUp = () => {
                          document.removeEventListener('mousemove', onMove);
                          document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                      }}
                    />
                  </SliderTrack>
                  <SliderLabels>
                    <span>4 lines</span>
                    <span>20 lines</span>
                  </SliderLabels>
                </SliderContainer>
              </Section>
            </>
          )}

          {generating && (
            <GeneratingBox>
              <CircularProgress size={40} sx={{ color: '#667eea' }} />
              <p>Generating your cover letter...</p>
            </GeneratingBox>
          )}

          {generated && !generating && (
            <ResultArea>
              <ResultLabel>
                <SectionLabel style={{ marginBottom: 0 }}>Your Cover Letter</SectionLabel>
              </ResultLabel>
              <ResultTextarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Your generated cover letter..."
              />
              <ActionRow>
                <ActionBtn className={copied ? 'copied' : ''} onClick={handleCopy}>
                  {copied ? <CheckCircle /> : <ContentCopy />}
                  {copied ? 'Copied!' : 'Copy'}
                </ActionBtn>
                <ActionBtn onClick={handleDownload}>
                  <Download /> Download
                </ActionBtn>
                <ActionBtn onClick={handleRegenerate}>
                  <Refresh /> Regenerate
                </ActionBtn>
              </ActionRow>
            </ResultArea>
          )}
        </Body>

        <Footer>
          <CancelBtn onClick={handleClose}>Cancel</CancelBtn>
          {!generated && (
            <GenerateBtn onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate'}
            </GenerateBtn>
          )}
        </Footer>
      </ModalContainer>
    </Dialog>
  );
}
