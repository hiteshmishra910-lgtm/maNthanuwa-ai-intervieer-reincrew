import React from 'react';

interface LogoProps {
  variant?: 'default' | 'white';
  className?: string;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  variant = 'default', 
  className = 'w-10 h-10', 
  alt = 'Reincrew AI Logo' 
}) => {
  const src = variant === 'white' ? '/logo-white.png' : '/logo.png';
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${className} object-contain`}
    />
  );
};
