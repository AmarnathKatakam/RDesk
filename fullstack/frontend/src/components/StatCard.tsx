/**
 * Component: components\StatCard.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface TrendInfo {
  value: number;
  isPositive: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: TrendInfo;
  subtitle?: string;
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'danger';
}

const colorStyles: Record<NonNullable<StatCardProps['color']>, string> = {
  primary: 'from-gray-900/20 to-gray-800/10 text-gray-900',
  accent: 'from-roth-accent/20 to-roth-accent/10 text-amber-700',
  success: 'from-emerald-600/20 to-emerald-500/10 text-emerald-700',
  warning: 'from-amber-500/20 to-amber-400/10 text-amber-700',
  danger: 'from-rose-500/20 to-rose-400/10 text-rose-700',
};

const iconBgStyles: Record<NonNullable<StatCardProps['color']>, string> = {
  primary: 'bg-gray-900',
  accent: 'bg-roth-accent',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color = 'primary',
}) => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.isPositive ? '+' : '-'}
              {Math.abs(trend.value)}% vs last month
            </p>
          )}
        </div>
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${colorStyles[color]} inline-flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${iconBgStyles[color] === 'bg-roth-accent' ? 'text-white' : ''}`} style={{ color: iconBgStyles[color] === 'bg-roth-accent' ? '#FFFFFF' : undefined }} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;

