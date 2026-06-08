import React from 'react';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
  onIconClick?: () => void;
}

const BrandMark: React.FC<BrandMarkProps> = ({ className = '', compact = false, onIconClick }) => {
  const textSize = compact ? 'text-2xl' : 'text-4xl';
  const leadSize = compact ? 'text-3xl' : 'text-5xl';
  const content = (
    <span
      className={`${textSize} bg-gradient-to-r from-teal-500 via-pink-500 to-purple-600 bg-clip-text text-transparent ${className}`.trim()}
      style={{ fontFamily: '"Droid Serif", serif' }}
    >
      <span className={`font-black ${leadSize}`}>R</span>Desk
    </span>
  );

  if (onIconClick) {
    return (
      <button type="button" onClick={onIconClick} aria-label="Go to admin home" className="inline-flex items-center text-left">
        {content}
      </button>
    );
  }

  return <h1>{content}</h1>;
};

export default BrandMark;
