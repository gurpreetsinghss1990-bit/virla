import React from 'react';
import { Text } from 'react-native';

interface SubtitleProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function Subtitle({ children, className = '', align = 'center' }: SubtitleProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return (
    <Text
      className={`text-[15px] font-semibold text-[#6B7280] leading-relaxed ${alignClass} ${className}`}
    >
      {children}
    </Text>
  );
}
