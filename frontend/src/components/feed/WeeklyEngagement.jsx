import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;

const Title = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 16px 0;
`;

const ChartWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 140px;
`;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklyEngagement = ({ data }) => {
  // Default data matching screenshot pattern
  const chartData = data || [5, 7, 5, 4, 8, 7, 10];
  const max = Math.max(...chartData, 10);
  const min = 0;
  
  const width = 220;
  const height = 110;
  const paddingLeft = 24;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 4;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const points = chartData.map((val, i) => ({
    x: paddingLeft + (i / (chartData.length - 1)) * chartW,
    y: paddingTop + chartH - ((val - min) / (max - min)) * chartH
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`;

  // Y-axis ticks
  const yTicks = [0, 5, 10];

  return (
    <Container>
      <Title>Weekly Engagement</Title>
      <ChartWrapper>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height + 20}`} preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = paddingTop + chartH - ((tick - min) / (max - min)) * chartH;
            return (
              <g key={tick}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                <text x={paddingLeft - 6} y={y + 4} textAnchor="end" fill="#888" fontSize="10">{tick}</text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="rgba(124,94,207,0.08)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="#7c5ecf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#7c5ecf" strokeWidth="2" />
            </g>
          ))}

          {/* X-axis labels */}
          {DAYS.map((day, i) => {
            const x = paddingLeft + (i / (DAYS.length - 1)) * chartW;
            return (
              <text key={day} x={x} y={height + 14} textAnchor="middle" fill="#888" fontSize="10">
                {day}
              </text>
            );
          })}
        </svg>
      </ChartWrapper>
    </Container>
  );
};

export default WeeklyEngagement;
