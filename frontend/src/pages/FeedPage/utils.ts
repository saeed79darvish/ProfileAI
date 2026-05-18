// Utils for FeedPage
import { COLORS } from '../../designTokens';

export type AchievementCategoryInfo = {
  label: string;
  iconName: 'medal' | 'book' | 'rocket' | 'star' | 'settings';
  color: string;
};

export const getAchievementCategory = (post: { content?: string; title?: string }): AchievementCategoryInfo => {
  const content = (post.content || '').toLowerCase();

  if (content.includes('promot') || content.includes('new role') || content.includes('hired') || content.includes('offer')) {
    return { label: 'Career Win', iconName: 'medal', color: COLORS.SECONDARY };
  }
  if (content.includes('learn') || content.includes('course') || content.includes('certif') || content.includes('skill')) {
    return { label: 'Learning', iconName: 'book', color: COLORS.PRIMARY_LIGHT };
  }
  if (content.includes('launch') || content.includes('ship') || content.includes('built') || content.includes('release')) {
    return { label: 'Project Launch', iconName: 'rocket', color: COLORS.SECONDARY };
  }
  if (content.includes('year') || content.includes('milestone') || content.includes('anniversary')) {
    return { label: 'Milestone', iconName: 'star', color: COLORS.SECONDARY };
  }
  return { label: 'Achievement', iconName: 'settings', color: COLORS.SECONDARY };
};
