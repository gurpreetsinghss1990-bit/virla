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
      className={`text-base text-zinc-500 leading-relaxed ${alignClass} ${className}`}
    >
      {children}
    </Text>
  );
}
