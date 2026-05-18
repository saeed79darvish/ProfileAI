import React from 'react';
import styled from 'styled-components';
import { Dialog } from '@mui/material';
import { AutoAwesome, Edit, Close } from '@mui/icons-material';

const Container = styled.div`
  padding: 28px 24px;
  text-align: center;
  @media (max-width: 600px) { padding: 24px 18px; }
`;

const IconWrap = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #F4F0FF;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  svg { font-size: 28px; color: #6941C6; }
`;

const Title = styled.h3`
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
`;

const Description = styled.p`
  margin: 0 0 24px;
  font-size: 14px;
  color: #667085;
  line-height: 1.55;
`;

const Buttons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PrimaryBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 13px 20px;
  border-radius: 12px;
  border: none;
  background: #6941C6;
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #5B34B5; }
  &:active { transform: scale(0.98); }
  svg { font-size: 18px; }
`;

const SecondaryBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 13px 20px;
  border-radius: 12px;
  border: 1.5px solid #D0D5DD;
  background: white;
  color: #344054;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #F9FAFB; }
  &:active { transform: scale(0.98); }
  svg { font-size: 18px; color: #667085; }
`;

const CancelBtn = styled.button`
  width: 100%;
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  &:hover { color: #667085; }
`;

export default function AlreadyTailoredModal({ open, onClose, onTailorAgain, onEdit, jobTitle, company }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ style: { borderRadius: 20, overflow: 'hidden' } }}
    >
      <Container>
        <IconWrap><AutoAwesome /></IconWrap>
        <Title>Already tailored</Title>
        <Description>
          You've already tailored your resume for{' '}
          <strong>{jobTitle}{company ? ` at ${company}` : ''}</strong>.
          Save your credit, edit the existing version instead, or tailor again from scratch.
        </Description>
        <Buttons>
          <PrimaryBtn onClick={onEdit}>
            <Edit /> Edit existing resume
          </PrimaryBtn>
          <SecondaryBtn onClick={onTailorAgain}>
            <AutoAwesome /> Tailor again
          </SecondaryBtn>
          <CancelBtn onClick={onClose}>Cancel</CancelBtn>
        </Buttons>
      </Container>
    </Dialog>
  );
}
