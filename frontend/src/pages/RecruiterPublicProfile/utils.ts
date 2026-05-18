import { resolveImageUrl } from '../../services/api';
import { TEXT } from './constants';

interface UserLike {
  firstName?: string;
  lastName?: string;
}

export const getFullName = (user: UserLike | null | undefined): string => {
  if (!user) return TEXT.DEFAULT_NAME;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || TEXT.DEFAULT_NAME;
};

export const getProfileImages = (profile: Record<string, any> | null) => ({
  profileImage: resolveImageUrl(profile?.profilePicture) || '',
  companyLogo: resolveImageUrl(profile?.companyLogo) || '',
});
