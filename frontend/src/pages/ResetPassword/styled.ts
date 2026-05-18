import styled from 'styled-components';

export const PasswordRequirement = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${props => props.met ? '#22c55e' : '#9ca3af'};
  
  svg {
    font-size: 16px;
  }
`;
