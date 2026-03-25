import React from 'react';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
}

const BrandMark: React.FC<BrandMarkProps> = ({ className = '', compact = false }) => {
  const textSize = compact ? 'text-2xl' : 'text-4xl';
  const leadSize = compact ? 'text-3xl' : 'text-5xl';

  return (
    <h1
      className={`${textSize} bg-gradient-to-r from-teal-500 via-pink-500 to-purple-600 bg-clip-text text-transparent ${className}`.trim()}
      style={{ fontFamily: '"Droid Serif", serif' }}
    >
      <span className={`font-black ${leadSize}`}>R</span>Desk
    </h1>
  );
};

export default BrandMark;
