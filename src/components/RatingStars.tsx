import { useState } from 'react';

interface RatingStarsProps {
  rating: number; // 0-5
  size?: 'small' | 'sm' | 'md' | 'lg';
  editable?: boolean;
  onChange?: (rating: number) => void;
}

export function RatingStars({ rating, size = 'sm', editable = false, onChange }: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const normalizedRating = Math.min(5, Math.max(0, Math.round(rating)));
  const displayRating = hoverRating ?? normalizedRating;

  const sizeClasses = {
    small: 'text-[10px]',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const handleClick = (star: number, e: React.MouseEvent) => {
    if (editable && onChange) {
      e.stopPropagation(); // Prevent row selection
      // Click on same rating clears it
      onChange(star === normalizedRating ? 0 : star);
    }
  };

  return (
    <div
      className={`flex gap-0.5 ${sizeClasses[size]} ${editable ? 'cursor-pointer' : ''}`}
      onMouseLeave={() => setHoverRating(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`
            ${star <= displayRating ? 'text-yellow-400' : 'text-gray-600'}
            ${editable ? 'hover:scale-110 transition-transform' : ''}
          `}
          onMouseEnter={() => editable && setHoverRating(star)}
          onClick={(e) => handleClick(star, e)}
        >
          ★
        </span>
      ))}
    </div>
  );
}
