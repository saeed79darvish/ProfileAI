import { PASSWORD_REQUIREMENTS } from './constants';

export const getPasswordStrength = (password: string) => {
  const checks = {
    minLength: password.length >= PASSWORD_REQUIREMENTS.MIN_LENGTH,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[@$!%*?&]/.test(password)
  };

  const passed = Object.values(checks).filter(Boolean).length;
  let strength = 'weak',
    color = '#ef4444',
    progress = 20;
  if (passed >= 5) {
    strength = 'strong';
    color = '#22c55e';
    progress = 100;
  } else if (passed >= 4) {
    strength = 'good';
    color = '#84cc16';
    progress = 80;
  } else if (passed >= 3) {
    strength = 'fair';
    color = '#eab308';
    progress = 60;
  } else if (passed >= 2) {
    strength = 'weak';
    color = '#f97316';
    progress = 40;
  }
  return { checks, strength, color, progress };
};
