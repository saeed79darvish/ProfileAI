export interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
  onClick?: () => void;
}
