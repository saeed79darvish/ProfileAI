import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

const Title = styled.h3`
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 16px 0;
`;

const TopicList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TopicRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
`;

const TopicName = styled.span`
  font-size: 14px;
  color: #7c5ecf;
  font-weight: 500;
  
  &::before {
    content: '#';
  }
`;

const SessionCount = styled.span`
  font-size: 12px;
  color: #666;
`;

const TrendingTopics = ({ topics = [], onTopicClick }) => {
  const defaultTopics = [
    { category: 'CareerGrowth', sessionCount: 124 },
    { category: 'TechTips', sessionCount: 89 },
    { category: 'Promotion', sessionCount: 67 },
    { category: 'Leadership', sessionCount: 45 }
  ];
  
  const displayTopics = topics.length > 0 ? topics : defaultTopics;
  
  return (
    <Container>
      <Title>Trending Topics</Title>
      <TopicList>
        {displayTopics.map((topic, idx) => (
          <TopicRow 
            key={idx}
            onClick={() => onTopicClick?.(topic.category)}
          >
            <TopicName>{topic.category}</TopicName>
            <SessionCount>{topic.sessionCount} sessions</SessionCount>
          </TopicRow>
        ))}
      </TopicList>
    </Container>
  );
};

export default TrendingTopics;
