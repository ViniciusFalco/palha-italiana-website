import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
}

const OptimizedImage = ({ src, alt, className = '' }: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative w-full h-full">
      {/* Placeholder/Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
      )}
      
      {/* Actual Image */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        style={{
          transform: 'translate3d(0, 0, 0)', // Force GPU acceleration
          willChange: 'opacity' // Hint browser about animation
        }}
      />
    </div>
  );
};

export default OptimizedImage;
