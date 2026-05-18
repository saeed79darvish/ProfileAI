import { ROUTES } from './constants';

export const getRecruiterDest = (u: any) =>
  (u?.hasRecruiterProfile === false) ? ROUTES.RECRUITER_ONBOARDING : ROUTES.RECRUITER_DASHBOARD;
