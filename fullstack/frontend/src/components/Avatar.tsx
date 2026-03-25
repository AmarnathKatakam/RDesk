/**
 * Component: components\Avatar.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';

interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const Avatar: React.FC<AvatarProps> = ({ name = 'User', size = 'md' }) => {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white font-semibold flex items-center justify-center`}
      title={name}
    >
      {initials}
    </div>
  );
};

export default Avatar;

